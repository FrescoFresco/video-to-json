import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StoredVideo, VideoJobResult } from "@/lib/types";
import {
  clearJobsFromDisk,
  loadAllJobsFromDisk,
  persistJob,
  type JobRecord,
} from "./job-persistence";
import { processVideoFile } from "./process-video";
import { withProcessSlot } from "./process-queue";
import { deliverWebhook } from "./webhook";

type JobStore = {
  jobs: Map<string, JobRecord>;
  loaded: boolean;
  loadPromise?: Promise<void>;
  persistTimers: Map<string, ReturnType<typeof setTimeout>>;
};

const globalForJobs = globalThis as typeof globalThis & {
  __vxJobStore?: JobStore;
};

function getStore(): JobStore {
  if (!globalForJobs.__vxJobStore) {
    globalForJobs.__vxJobStore = {
      jobs: new Map<string, JobRecord>(),
      loaded: false,
      persistTimers: new Map(),
    };
  }
  const store = globalForJobs.__vxJobStore;
  // HMR / reinicios parciales pueden dejar el store a medias.
  if (!store.jobs) store.jobs = new Map();
  if (!store.persistTimers) store.persistTimers = new Map();
  return store;
}

async function ensureLoaded() {
  const store = getStore();
  if (store.loaded) return;
  if (!store.loadPromise) {
    store.loadPromise = loadAllJobsFromDisk().then((jobs) => {
      store.jobs = jobs;
      store.loaded = true;
    });
  }
  await store.loadPromise;
}

function clock() {
  return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function createId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function schedulePersist(job: JobRecord, immediate = false) {
  const store = getStore();
  const existing = store.persistTimers.get(job.id);
  if (existing) clearTimeout(existing);

  const write = () => {
    store.persistTimers.delete(job.id);
    void persistJob(job).catch(() => undefined);
  };

  if (immediate) {
    write();
    return;
  }

  // Progreso frecuente: no saturar disco.
  store.persistTimers.set(job.id, setTimeout(write, 400));
}

function updateJob(id: string, patch: Partial<JobRecord>, immediate = false) {
  const store = getStore();
  const current = store.jobs.get(id);
  if (!current) return;
  const next = { ...current, ...patch };
  store.jobs.set(id, next);
  schedulePersist(next, immediate);
}

export async function listJobs(): Promise<StoredVideo[]> {
  await ensureLoaded();
  return [...getStore().jobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ result, ...job }) => job);
}

export async function getJob(id: string): Promise<StoredVideo | null> {
  await ensureLoaded();
  const job = getStore().jobs.get(id);
  if (!job) return null;
  const { result, ...rest } = job;
  return rest;
}

export async function getJobResult(id: string): Promise<VideoJobResult | null> {
  await ensureLoaded();
  return getStore().jobs.get(id)?.result ?? null;
}

export async function createJobFromUpload(
  file: File,
  options?: { webhookUrl?: string | null }
): Promise<StoredVideo> {
  await ensureLoaded();
  const id = createId();
  const createdAt = new Date().toISOString();
  const dir = path.join(os.tmpdir(), "vx-jobs");
  await mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${id}-${file.name.replace(/[^\w.-]+/g, "_")}`);
  await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
  const webhookUrl = options?.webhookUrl?.trim() || null;

  const job: JobRecord = {
    id,
    name: file.name,
    createdAt,
    status: "queued",
    progress: 5,
    stage: "En espera",
    activity: [{ time: clock(), title: "Archivo recibido", detail: file.name, status: "ready" }],
  };

  getStore().jobs.set(id, job);
  schedulePersist(job, true);

  void withProcessSlot({
    onWaiting: () => {
      updateJob(id, {
        status: "queued",
        stage: "En espera",
        progress: 5,
      });
    },
    onStarted: () => {
      updateJob(id, {
        status: "processing",
        stage: "Procesando",
        progress: 8,
      });
    },
    run: async () => {
      try {
        const result = await processVideoFile(tempPath, file.name, (progress, stage) => {
          const current = getStore().jobs.get(id);
          if (!current) return;
          updateJob(id, {
            status: "processing",
            progress,
            stage,
          });
        });

        updateJob(
          id,
          {
            status: "ready",
            progress: 100,
            stage: "Listo",
            probe: result.probe,
            extraction: result.extraction,
            result,
            activity: [
              ...(getStore().jobs.get(id)?.activity ?? []),
              {
                time: clock(),
                title: "Media",
                detail: `${result.probe.width}×${result.probe.height} · ${Math.round(result.probe.durationMs / 1000)} s`,
                status: "ready",
              },
              ...result.modules.map((mod) => ({
                time: clock(),
                title: mod.title,
                detail: mod.error ? `${mod.summary}: ${mod.error}` : mod.summary,
                status: (mod.status === "error" ? "error" : "ready") as StoredVideo["status"],
              })),
            ],
          },
          true
        );

        const readyJob = getStore().jobs.get(id);
        if (!readyJob) return;
        const delivery = await deliverWebhook({
          event: "job.ready",
          job: readyJob,
          result,
          webhookUrl,
        });
        if (delivery) {
          updateJob(
            id,
            {
              activity: [
                ...(getStore().jobs.get(id)?.activity ?? []),
                {
                  time: clock(),
                  title: "Webhook",
                  detail: delivery.ok
                    ? `Enviado a ${delivery.url} (HTTP ${delivery.status})`
                    : `Falló: ${delivery.error || "error"}`,
                  status: delivery.ok ? "ready" : "error",
                },
              ],
            },
            true
          );
        }
      } catch (error) {
        updateJob(
          id,
          {
            status: "error",
            progress: 100,
            stage: "Error",
            error: error instanceof Error ? error.message : "No se pudo procesar el vídeo",
            activity: [
              ...(getStore().jobs.get(id)?.activity ?? []),
              {
                time: clock(),
                title: "Procesamiento",
                detail: error instanceof Error ? error.message : "No se pudo procesar el vídeo",
                status: "error",
              },
            ],
          },
          true
        );

        const failedJob = getStore().jobs.get(id);
        if (!failedJob) return;
        const delivery = await deliverWebhook({
          event: "job.error",
          job: failedJob,
          webhookUrl,
        });
        if (delivery) {
          updateJob(
            id,
            {
              activity: [
                ...(getStore().jobs.get(id)?.activity ?? []),
                {
                  time: clock(),
                  title: "Webhook",
                  detail: delivery.ok
                    ? `Aviso de error enviado a ${delivery.url}`
                    : `Falló el aviso: ${delivery.error || "error"}`,
                  status: delivery.ok ? "ready" : "error",
                },
              ],
            },
            true
          );
        }
      }
    },
  });

  return (await getJob(id)) as StoredVideo;
}

export async function clearJobs() {
  await ensureLoaded();
  const store = getStore();
  for (const timer of store.persistTimers.values()) clearTimeout(timer);
  store.persistTimers.clear();
  store.jobs.clear();
  await clearJobsFromDisk();
}
