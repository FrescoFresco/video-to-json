import type { JobStatus, StoredVideo } from "./types";
import { formatElapsed } from "./format-time";

export { formatElapsed, formatModuleDuration } from "./format-time";

/** Nº de módulos por defecto si aún no hay catálogo. */
const DEFAULT_MODULES = 13;

/**
 * Estimación bruta en CPU local para un vídeo completo.
 * No es exacta: Whisper/visión varían mucho; sirve de orden de magnitud.
 */
export function estimateJobSeconds(
  video: Pick<StoredVideo, "probe" | "extraction">,
  moduleCount = DEFAULT_MODULES
): number {
  const durationMs =
    video.probe?.durationMs ??
    video.extraction?.media.duration_ms ??
    45_000;
  const durationSec = Math.max(5, durationMs / 1000);
  const modules = Math.max(4, moduleCount);

  // base arranque + ~2.4× duración + coste fijo por módulo (visión/OCR/etc.)
  return Math.round(35 + durationSec * 2.4 + modules * 11);
}

/** Segundos que quedan de ESTE job (sin contar cola delante). */
export function remainingForJob(
  video: StoredVideo,
  moduleCount = DEFAULT_MODULES,
  nowMs = Date.now()
): number | null {
  if (video.status === "ready" || video.status === "error") return null;

  const total = estimateJobSeconds(video, moduleCount);
  if (video.status === "queued") return total;

  const progress = Math.max(1, Math.min(99, video.progress || 1));
  let remaining = total * (1 - progress / 100);

  if (video.processingStartedAt) {
    const started = Date.parse(video.processingStartedAt);
    if (Number.isFinite(started)) {
      const elapsed = Math.max(0, (nowMs - started) / 1000);
      if (progress >= 8 && elapsed >= 4) {
        const paceRemaining = elapsed * ((100 - progress) / progress);
        remaining = paceRemaining * 0.72 + remaining * 0.28;
      }
    }
  }

  return Math.max(5, Math.round(remaining));
}

/**
 * Tiempo hasta terminar este job contando la cola delante
 * (procesando + en espera anteriores).
 */
export function etaUntilDone(
  video: StoredVideo,
  all: StoredVideo[],
  moduleCount = DEFAULT_MODULES,
  nowMs = Date.now()
): number | null {
  if (video.status === "ready" || video.status === "error") return null;

  const queue = all
    .filter((v) => v.status === "processing" || v.status === "queued")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "processing" ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

  let seconds = 0;
  for (const item of queue) {
    const part = remainingForJob(item, moduleCount, nowMs) ?? estimateJobSeconds(item, moduleCount);
    seconds += part;
    if (item.id === video.id) break;
  }

  return Math.max(5, Math.round(seconds));
}

export function formatEta(seconds: number): string {
  if (seconds < 45) return `≈ ${Math.max(5, Math.round(seconds / 5) * 5)} s`;
  if (seconds < 90) return "≈ 1 min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `≈ ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `≈ ${h} h ${m} min` : `≈ ${h} h`;
}

export function etaLabel(
  video: StoredVideo,
  all: StoredVideo[],
  moduleCount = DEFAULT_MODULES,
  nowMs = Date.now()
): string | null {
  if (video.status === "error") return null;

  if (video.status === "ready") {
    if (video.processingStartedAt && video.completedAt) {
      const start = Date.parse(video.processingStartedAt);
      const end = Date.parse(video.completedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        return `Tardó ${formatElapsed((end - start) / 1000)}`;
      }
    }
    return null;
  }

  const until = etaUntilDone(video, all, moduleCount, nowMs);
  if (until == null) return null;

  if (video.status === "queued") {
    const own = remainingForJob(video, moduleCount, nowMs) ?? until;
    const wait = Math.max(0, until - own);
    if (wait >= 20) return `En cola · listo en ${formatEta(until)}`;
    return `Estimado ${formatEta(until)}`;
  }

  return `Quedan ${formatEta(until)}`;
}

export function statusIsActive(status: JobStatus) {
  return status === "queued" || status === "processing";
}
