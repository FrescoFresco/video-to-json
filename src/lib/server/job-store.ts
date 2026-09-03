import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StoredVideo, VideoJobResult } from "@/lib/types";
import { processVideoFile } from "./process-video";

type JobRecord = StoredVideo & {
  result?: VideoJobResult;
};

type JobStore = {
  jobs: Map<string, JobRecord>;
};

const globalForJobs = globalThis as typeof globalThis & {
  __vxJobStore?: JobStore;
};

function getStore(): JobStore {
  if (!globalForJobs.__vxJobStore) {
    globalForJobs.__vxJobStore = {
      jobs: new Map<string, JobRecord>(),
    };
  }
  return globalForJobs.__vxJobStore;
}

function clock() {
  return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function createId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function updateJob(id: string, patch: Partial<JobRecord>) {
  const store = getStore();
  const current = store.jobs.get(id);
  if (!current) return;
  store.jobs.set(id, { ...current, ...patch });
}

export function listJobs(): StoredVideo[] {
  return [...getStore().jobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ result, ...job }) => job);
}

export function getJob(id: string): StoredVideo | null {
  const job = getStore().jobs.get(id);
  if (!job) return null;
  const { result, ...rest } = job;
  return rest;
}

export function getJobResult(id: string): VideoJobResult | null {
  return getStore().jobs.get(id)?.result ?? null;
}

export async function createJobFromUpload(file: File): Promise<StoredVideo> {
  const id = createId();
  const createdAt = new Date().toISOString();
  const dir = path.join(os.tmpdir(), "vx-jobs");
  await mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${id}-${file.name.replace(/[^\w.-]+/g, "_")}`);
  await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));

  const job: JobRecord = {
    id,
    name: file.name,
    createdAt,
    status: "queued",
    progress: 5,
    stage: "Vídeo recibido",
    activity: [{ time: clock(), title: "Archivo recibido", detail: file.name, status: "ready" }],
  };

  getStore().jobs.set(id, job);

  void processVideoFile(tempPath, file.name, (progress, stage) => {
    const current = getStore().jobs.get(id);
    if (!current) return;
    updateJob(id, {
      status: "processing",
      progress,
      stage,
    });
  })
    .then((result) => {
      updateJob(id, {
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
      });
    })
    .catch((error) => {
      updateJob(id, {
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
      });
    });

  return getJob(id) as StoredVideo;
}

export function clearJobs() {
  getStore().jobs.clear();
}
