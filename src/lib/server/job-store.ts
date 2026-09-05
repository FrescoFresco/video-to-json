import { writeFile, mkdir, copyFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { JobDeliveries, StoredVideo, VideoJobResult } from "@/lib/types";
import {
  clearJobResultFile,
  clearJobsFromDisk,
  jobSourceExists,
  jobSourcePath,
  loadAllJobsFromDisk,
  persistJob,
  saveJobSource,
  type JobRecord,
} from "./job-persistence";
import { processVideoFile } from "./process-video";
import { withProcessSlot } from "./process-queue";
import { uploadJsonToDrive } from "./google-drive";
import { hasDriveAuth, readAppConfig } from "./app-config";
import { deliverWebhook } from "./webhook";
import { buildVideoExtraction } from "@/lib/extraction";
import {
  cleanupDownloadDir,
  downloadVideoFromUrl,
  parseAllowedVideoUrl,
} from "./url-download";

type JobStore = {
  jobs: Map<string, JobRecord>;
  loaded: boolean;
  loadPromise?: Promise<void>;
  persistTimers: Map<string, ReturnType<typeof setTimeout>>;
};

type EnqueueOptions = {
  webhookUrl?: string | null;
  sourceUrl?: string | null;
  sourceKind?: StoredVideo["sourceKind"];
  /** Si el job ya tiene id (p. ej. link o reintento). */
  existingId?: string;
  keepSource?: boolean;
  onReady?: (result: VideoJobResult, job: JobRecord) => Promise<void> | void;
  onError?: (error: string, job: JobRecord) => Promise<void> | void;
};

export class JobRetryError extends Error {
  constructor(
    public code: "not_found" | "not_error" | "no_source" | "busy",
    message: string
  ) {
    super(message);
    this.name = "JobRetryError";
  }
}

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
      // Tras reinicio no se puede retomar un vídeo temporal ya borrado.
      for (const [id, job] of jobs) {
        if (job.status === "queued" || job.status === "processing") {
          jobs.set(id, {
            ...job,
            status: "error",
            progress: 100,
            stage: "Error",
            error:
              job.sourceUrl
                ? "Interrumpido al reiniciar el servidor. Pulsa Reintentar."
                : "Interrumpido al reiniciar el servidor. Vuelve a subir el vídeo o pulsa Reintentar si aún está guardado.",
          });
        }
      }
      store.jobs = jobs;
      store.loaded = true;
      for (const job of jobs.values()) {
        if (job.status === "error" && job.error?.includes("Interrumpido")) {
          schedulePersist(job, true);
        }
      }
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

async function enqueueVideoJob(
  filename: string,
  tempPath: string,
  options?: EnqueueOptions
): Promise<StoredVideo> {
  await ensureLoaded();
  const id = options?.existingId || createId();
  const createdAt = new Date().toISOString();

  const inputFile = await saveJobSource(id, tempPath, filename);
  await unlink(/*turbopackIgnore: true*/ tempPath).catch(() => undefined);
  const sourcePath = jobSourcePath(id, inputFile);

  const existing = getStore().jobs.get(id);
  const job: JobRecord = {
    id,
    name: filename,
    createdAt: existing?.createdAt || createdAt,
    status: "queued",
    progress: 5,
    stage: "En espera",
    sourceKind: options?.sourceKind || existing?.sourceKind || "upload",
    inputFile,
    ...(options?.sourceUrl || existing?.sourceUrl
      ? { sourceUrl: options?.sourceUrl || existing?.sourceUrl }
      : {}),
    activity: [
      ...(existing?.activity ?? []),
      {
        time: clock(),
        title: existing ? "Archivo listo" : "Archivo recibido",
        detail: filename,
        status: "ready",
      },
    ],
  };

  getStore().jobs.set(id, job);
  schedulePersist(job, true);

  void runQueuedProcessing(id, filename, sourcePath, {
    ...options,
    keepSource: true,
  });

  return (await getJob(id)) as StoredVideo;
}

export async function createJobFromUpload(
  file: File,
  options?: { webhookUrl?: string | null }
): Promise<StoredVideo> {
  const dir = path.join(os.tmpdir(), "vx-jobs");
  await mkdir(dir, { recursive: true });
  const idHint = createId();
  const tempPath = path.join(dir, `${idHint}-${file.name.replace(/[^\w.-]+/g, "_")}`);
  await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
  return enqueueVideoJob(file.name, tempPath, { ...options, sourceKind: "upload" });
}

/** Encola un vídeo ya presente en disco (carpeta inbox / Drive Desktop). */
export async function createJobFromLocalPath(
  filePath: string,
  options?: EnqueueOptions & { displayName?: string }
): Promise<StoredVideo> {
  const filename = options?.displayName || path.basename(filePath);
  const dir = path.join(os.tmpdir(), "vx-jobs");
  await mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `${createId()}-${filename.replace(/[^\w.-]+/g, "_")}`);
  await copyFile(/*turbopackIgnore: true*/ filePath, /*turbopackIgnore: true*/ tempPath);
  return enqueueVideoJob(filename, tempPath, { ...options, sourceKind: "folder" });
}

/**
 * Crea un trabajo desde un link (TikTok, Instagram, YouTube…).
 * Primero descarga; luego entra en la misma cola de extracción.
 */
export async function createJobFromUrl(
  rawUrl: string,
  options?: { webhookUrl?: string | null }
): Promise<StoredVideo> {
  const url = parseAllowedVideoUrl(rawUrl);
  await ensureLoaded();

  const id = createId();
  const createdAt = new Date().toISOString();
  const webhookUrl = options?.webhookUrl?.trim() || null;
  const displayHost = url.hostname.replace(/^www\./, "");

  const job: JobRecord = {
    id,
    name: displayHost,
    createdAt,
    status: "processing",
    progress: 3,
    stage: "Descargando desde link…",
    processingStartedAt: createdAt,
    sourceKind: "url",
    sourceUrl: url.href,
    activity: [
      {
        time: clock(),
        title: "Link recibido",
        detail: url.href.slice(0, 120),
        status: "ready",
      },
    ],
  };

  getStore().jobs.set(id, job);
  schedulePersist(job, true);

  void (async () => {
    await downloadAndProcessUrlJob(id, url.href, webhookUrl);
  })();

  return (await getJob(id)) as StoredVideo;
}

/** Descarga un link, guarda el archivo y encola la extracción (también usado al reintentar). */
async function downloadAndProcessUrlJob(
  id: string,
  href: string,
  webhookUrl?: string | null
) {
  let workDir: string | undefined;
  try {
    const downloaded = await downloadVideoFromUrl(href);
    workDir = downloaded.workDir;

    const dir = path.join(os.tmpdir(), "vx-jobs");
    await mkdir(dir, { recursive: true });
    const tempPath = path.join(
      dir,
      `${id}-${downloaded.filename.replace(/[^\w.-]+/g, "_")}`
    );
    await copyFile(
      /*turbopackIgnore: true*/ downloaded.filePath,
      /*turbopackIgnore: true*/ tempPath
    );
    await cleanupDownloadDir(workDir);
    workDir = undefined;

    const inputFile = await saveJobSource(id, tempPath, downloaded.filename);
    await unlink(/*turbopackIgnore: true*/ tempPath).catch(() => undefined);
    const sourcePath = jobSourcePath(id, inputFile);

    updateJob(
      id,
      {
        name: downloaded.filename,
        status: "queued",
        progress: 5,
        stage: "En espera",
        inputFile,
        sourceUrl: downloaded.sourceUrl || href,
        sourceKind: "url",
        activity: [
          ...(getStore().jobs.get(id)?.activity ?? []),
          {
            time: clock(),
            title: "Descarga",
            detail: downloaded.extractor
              ? `${downloaded.filename} · ${downloaded.extractor}`
              : downloaded.filename,
            status: "ready",
          },
        ],
      },
      true
    );

    await runQueuedProcessing(id, downloaded.filename, sourcePath, {
      webhookUrl,
      sourceUrl: downloaded.sourceUrl || href,
      sourceKind: "url",
      keepSource: true,
    });
  } catch (error) {
    await cleanupDownloadDir(workDir);
    const message =
      error instanceof Error ? error.message : "No se pudo descargar el vídeo";
    updateJob(
      id,
      {
        status: "error",
        progress: 100,
        stage: "Error",
        error: message,
        completedAt: new Date().toISOString(),
        activity: [
          ...(getStore().jobs.get(id)?.activity ?? []),
          {
            time: clock(),
            title: "Descarga",
            detail: message,
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
}

/**
 * Vuelve a lanzar un trabajo en error: reusa el archivo guardado o vuelve a bajar el link.
 */
export async function retryJob(id: string): Promise<StoredVideo> {
  await ensureLoaded();
  const job = getStore().jobs.get(id);
  if (!job) {
    throw new JobRetryError("not_found", "Trabajo no encontrado");
  }
  if (job.status === "queued" || job.status === "processing") {
    throw new JobRetryError("busy", "El trabajo ya se está procesando");
  }
  if (job.status !== "error") {
    throw new JobRetryError(
      "not_error",
      "Solo se pueden reintentar trabajos que hayan fallado"
    );
  }

  const sourceUrl = job.sourceUrl?.trim() || null;
  const hasSource = await jobSourceExists(id, job.inputFile);

  if (!hasSource && !sourceUrl) {
    throw new JobRetryError(
      "no_source",
      "Ya no está el vídeo guardado. Vuelve a subirlo o pega el link otra vez."
    );
  }

  await clearJobResultFile(id);

  const resetActivity = [
    ...(job.activity ?? []),
    {
      time: clock(),
      title: "Reintento",
      detail: hasSource
        ? "Se vuelve a procesar el mismo archivo"
        : "Se vuelve a descargar el link",
      status: "ready" as const,
    },
  ];

  updateJob(
    id,
    {
      status: hasSource ? "queued" : "processing",
      progress: hasSource ? 5 : 3,
      stage: hasSource ? "En espera" : "Descargando desde link…",
      error: undefined,
      completedAt: undefined,
      processingStartedAt: hasSource ? undefined : new Date().toISOString(),
      stageStartedAt: undefined,
      probe: undefined,
      extraction: undefined,
      result: undefined,
      deliveries: undefined,
      activity: resetActivity,
    },
    true
  );

  if (hasSource && job.inputFile) {
    const sourcePath = jobSourcePath(id, job.inputFile);
    void runQueuedProcessing(id, job.name, sourcePath, {
      sourceUrl,
      sourceKind: job.sourceKind || (sourceUrl ? "url" : "upload"),
      keepSource: true,
    });
  } else if (sourceUrl) {
    void downloadAndProcessUrlJob(id, sourceUrl, null);
  }

  return (await getJob(id)) as StoredVideo;
}

/** Cola + processVideoFile compartido por upload, inbox y links. */
async function runQueuedProcessing(
  id: string,
  filename: string,
  tempPath: string,
  options?: EnqueueOptions
) {
  await withProcessSlot({
    onWaiting: () => {
      updateJob(id, {
        status: "queued",
        stage: "En espera",
        progress: 5,
      });
    },
    onStarted: () => {
      const current = getStore().jobs.get(id);
      updateJob(id, {
        status: "processing",
        stage: "Procesando",
        progress: Math.max(8, current?.progress || 8),
        processingStartedAt: current?.processingStartedAt || new Date().toISOString(),
      });
    },
    run: async () => {
      try {
        const currentJob = getStore().jobs.get(id);
        const sourceUrl = options?.sourceUrl || currentJob?.sourceUrl || null;
        const sourceKind =
          options?.sourceKind || currentJob?.sourceKind || (sourceUrl ? "url" : "upload");

        const result = await processVideoFile(tempPath, filename, {
          keepSource: options?.keepSource === true,
          source: { url: sourceUrl, kind: sourceKind },
          onProgress: (progress, stage) => {
            const current = getStore().jobs.get(id);
            if (!current) return;
            const stageChanged = stage !== current.stage;
            updateJob(id, {
              status: "processing",
              progress,
              stage,
              ...(stageChanged ? { stageStartedAt: new Date().toISOString() } : {}),
            });
          },
          onProbe: (probe) => {
            const current = getStore().jobs.get(id);
            if (!current) return;
            updateJob(
              id,
              {
                probe,
                activity: [
                  ...(current.activity ?? []),
                  {
                    time: clock(),
                    title: "Media",
                    detail: `${probe.width}×${probe.height} · ${Math.round(probe.durationMs / 1000)} s`,
                    status: "ready",
                  },
                ],
              },
              true
            );
          },
          onModule: ({ module, modules, probe }) => {
            const current = getStore().jobs.get(id);
            if (!current) return;
            const extraction = buildVideoExtraction({
              filename,
              processedAt: new Date().toISOString(),
              probe,
              modules,
              sourceUrl: current.sourceUrl || sourceUrl,
              sourceKind: current.sourceKind || sourceKind,
            });
            updateJob(
              id,
              {
                status: "processing",
                probe,
                extraction,
                activity: [
                  ...(current.activity ?? []),
                  {
                    time: clock(),
                    title: module.title,
                    detail: module.error
                      ? `${module.summary}: ${module.error}`
                      : typeof module.duration_ms === "number"
                        ? `${module.summary} · ${Math.round(module.duration_ms / 1000) || "<1"} s`
                        : module.summary,
                    status: (module.status === "error" ? "error" : "ready") as StoredVideo["status"],
                  },
                ],
              },
              true
            );
          },
        });

        const config = await readAppConfig();
        const willWebhook = Boolean(
          (options?.webhookUrl || config.webhookUrl || "").trim()
        );
        const willDrive =
          config.driveEnabled &&
          Boolean(config.driveFolderId?.trim()) &&
          hasDriveAuth(config);
        const needsDelivery = willWebhook || willDrive;

        const initialDeliveries: JobDeliveries = {
          drive: willDrive
            ? { status: "pending", label: "Google Drive" }
            : {
                status: "skipped",
                label: "Google Drive",
                detail: "No configurado en Conexiones",
              },
          webhook: willWebhook
            ? { status: "pending", label: "Webhook" }
            : {
                status: "skipped",
                label: "Webhook",
                detail: "No configurado en Conexiones",
              },
        };

        updateJob(
          id,
          {
            status: needsDelivery ? "processing" : "ready",
            progress: needsDelivery ? 94 : 100,
            stage: needsDelivery ? "Enviando resultados…" : "Listo",
            probe: result.probe,
            extraction: result.extraction,
            result,
            completedAt: needsDelivery ? undefined : new Date().toISOString(),
            ...(sourceUrl ? { sourceUrl } : {}),
            sourceKind,
            deliveries: initialDeliveries,
            activity: [
              ...(getStore().jobs.get(id)?.activity ?? []),
              {
                time: clock(),
                title: "Extracción",
                detail: needsDelivery
                  ? "Módulos listos. Enviando JSON a los destinos…"
                  : "Módulos listos.",
                status: "ready",
              },
            ],
          },
          true
        );

        const readyJob = getStore().jobs.get(id);
        if (!readyJob) return;
        try {
          await options?.onReady?.(result, readyJob);
        } catch {
          // El callback de carpeta no debe tumbar el job.
        }

        let deliveries: JobDeliveries = {
          ...initialDeliveries,
        };

        if (willWebhook) {
          updateJob(
            id,
            {
              stage: "Enviando webhook…",
              progress: 96,
              deliveries: {
                ...deliveries,
                webhook: {
                  status: "uploading",
                  label: "Webhook",
                  detail: "Enviando…",
                },
              },
            },
            true
          );
          const delivery = await deliverWebhook({
            event: "job.ready",
            job: getStore().jobs.get(id) ?? readyJob,
            result,
            webhookUrl: options?.webhookUrl,
          });
          deliveries = {
            ...deliveries,
            webhook: delivery
              ? {
                  status: delivery.ok ? "ok" : "error",
                  label: "Webhook",
                  detail: delivery.ok
                    ? `Enviado (HTTP ${delivery.status})`
                    : delivery.error || "Error",
                  url: delivery.ok ? delivery.url : undefined,
                }
              : {
                  status: "skipped",
                  label: "Webhook",
                  detail: "Sin URL",
                },
          };
          updateJob(
            id,
            {
              deliveries,
              activity: [
                ...(getStore().jobs.get(id)?.activity ?? []),
                {
                  time: clock(),
                  title: "Webhook",
                  detail:
                    deliveries.webhook?.detail ||
                    (delivery?.ok ? "Enviado" : "Falló"),
                  status: delivery?.ok ? "ready" : "error",
                },
              ],
            },
            true
          );
        }

        if (willDrive) {
          updateJob(
            id,
            {
              stage: "Subiendo a Google Drive…",
              progress: 98,
              deliveries: {
                ...deliveries,
                drive: {
                  status: "uploading",
                  label: "Google Drive",
                  detail: "Subiendo JSON…",
                },
              },
            },
            true
          );
          const driveUpload = await uploadJsonToDrive({
            fileName: `${readyJob.id}-${readyJob.name.replace(/\.[^.]+$/, "")}.json`,
            json: result.extraction ?? readyJob.extraction ?? result,
          });
          deliveries = {
            ...deliveries,
            drive: driveUpload
              ? {
                  status: driveUpload.ok ? "ok" : "error",
                  label: "Google Drive",
                  detail: driveUpload.ok
                    ? driveUpload.name || "JSON subido"
                    : driveUpload.error || "Error",
                  url: driveUpload.ok ? driveUpload.webViewLink : undefined,
                }
              : {
                  status: "skipped",
                  label: "Google Drive",
                  detail: "No activo",
                },
          };
          updateJob(
            id,
            {
              deliveries,
              activity: [
                ...(getStore().jobs.get(id)?.activity ?? []),
                {
                  time: clock(),
                  title: "Google Drive",
                  detail: driveUpload?.ok
                    ? driveUpload.webViewLink
                      ? `Subido: ${driveUpload.webViewLink}`
                      : `Subido (${driveUpload.name || driveUpload.fileId})`
                    : `Falló: ${driveUpload?.error || "error"}`,
                  status: driveUpload?.ok ? "ready" : "error",
                },
              ],
            },
            true
          );
        }

        updateJob(
          id,
          {
            status: "ready",
            progress: 100,
            stage: "Listo",
            completedAt: new Date().toISOString(),
            deliveries,
          },
          true
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo procesar el vídeo";
        updateJob(
          id,
          {
            status: "error",
            progress: 100,
            stage: "Error",
            error: message,
            completedAt: new Date().toISOString(),
            activity: [
              ...(getStore().jobs.get(id)?.activity ?? []),
              {
                time: clock(),
                title: "Procesamiento",
                detail: message,
                status: "error",
              },
            ],
          },
          true
        );

        const failedJob = getStore().jobs.get(id);
        if (!failedJob) return;
        try {
          await options?.onError?.(message, failedJob);
        } catch {
          // ignore
        }
        const delivery = await deliverWebhook({
          event: "job.error",
          job: failedJob,
          webhookUrl: options?.webhookUrl,
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
}

export async function clearJobs() {
  await ensureLoaded();
  const store = getStore();
  for (const timer of store.persistTimers.values()) clearTimeout(timer);
  store.persistTimers.clear();
  store.jobs.clear();
  await clearJobsFromDisk();
}
