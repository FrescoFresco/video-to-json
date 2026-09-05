import type { JobStatus, StoredVideo } from "./types";
import { formatElapsed } from "./format-time";
import {
  DEFAULT_COST,
  estimateJobBreakdown,
  findModuleIndexByStage,
  type PipelineCostConfig,
} from "./pipeline-cost";

export { formatElapsed, formatModuleDuration } from "./format-time";
export type { CostConfig, PipelineCostConfig } from "./pipeline-cost";
export {
  DEFAULT_COST,
  defaultCostConfig,
  estimateJobBreakdown,
  costConfigFromEnv,
  costSummaryForDuration,
} from "./pipeline-cost";

const DEFAULT_MODULES = 12;

function durationSecOf(video: Pick<StoredVideo, "probe" | "extraction">) {
  const durationMs =
    video.probe?.durationMs ?? video.extraction?.media.duration_ms ?? 45_000;
  return Math.max(5, durationMs / 1000);
}

/**
 * Estimación de un job completo según costes por módulo
 * (Whisper, VLM, frames, audio…), no un coeficiente genérico.
 */
export function estimateJobSeconds(
  video: Pick<StoredVideo, "probe" | "extraction">,
  _moduleCount = DEFAULT_MODULES,
  cfg: PipelineCostConfig = DEFAULT_COST
): number {
  return estimateJobBreakdown(durationSecOf(video), cfg).totalSec;
}

/**
 * Restante de ESTE job.
 * Si conocemos el stage, suma el módulo actual (parcial) + los que faltan.
 * Si hay ritmo real (elapsed vs progreso), lo mezcla con cuidado.
 */
export function remainingForJob(
  video: StoredVideo,
  moduleCount = DEFAULT_MODULES,
  nowMs = Date.now(),
  cfg: PipelineCostConfig = DEFAULT_COST
): number | null {
  if (video.status === "ready" || video.status === "error") return null;

  const breakdown = estimateJobBreakdown(durationSecOf(video), cfg);
  const total = breakdown.totalSec;
  if (video.status === "queued") return total;

  let modelRemaining = total;

  const stage = video.stage || "";
  const moduleIdx = findModuleIndexByStage(stage);

  if (moduleIdx >= 0) {
    const current = breakdown.modules[moduleIdx];
    const after = breakdown.modules
      .slice(moduleIdx + 1)
      .reduce((s, m) => s + m.seconds, 0);
    let currentLeft = current.seconds;

    if (video.stageStartedAt) {
      const started = Date.parse(video.stageStartedAt);
      if (Number.isFinite(started)) {
        const elapsedStage = Math.max(0, (nowMs - started) / 1000);
        // No dar el módulo por terminado hasta que cambie el stage.
        const frac = Math.min(0.9, elapsedStage / Math.max(current.seconds, 1));
        currentLeft = current.seconds * (1 - frac);
      }
    }
    modelRemaining = Math.max(8, currentLeft + after + breakdown.composeSec);
  } else if (/metadatos|espera|procesando|descarg|leyendo/i.test(stage)) {
    // Probe / pre-módulos: casi todo el job por delante.
    modelRemaining = Math.max(
      breakdown.composeSec,
      total - breakdown.probeSec * 0.5
    );
  } else if (/compon/i.test(stage)) {
    modelRemaining = Math.max(3, breakdown.composeSec);
  }

  // Ritmo global: solo si el progreso ya es fiable y ponderado por coste.
  const progress = Math.max(1, Math.min(99, video.progress || 1));
  let remaining = modelRemaining;

  if (video.processingStartedAt) {
    const started = Date.parse(video.processingStartedAt);
    if (Number.isFinite(started)) {
      const elapsed = Math.max(0, (nowMs - started) / 1000);
      if (progress >= 8 && elapsed >= 15) {
        const paceRemaining = elapsed * ((100 - progress) / progress);
        // El modelo de módulos pesa más; el ritmo corrige desviaciones de máquina.
        remaining = paceRemaining * 0.35 + modelRemaining * 0.65;
      }
    }
  } else {
    remaining = total * (1 - progress / 100);
  }

  return Math.max(8, Math.round(remaining));
}

export function etaUntilDone(
  video: StoredVideo,
  all: StoredVideo[],
  moduleCount = DEFAULT_MODULES,
  nowMs = Date.now(),
  cfg: PipelineCostConfig = DEFAULT_COST
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
    const part =
      remainingForJob(item, moduleCount, nowMs, cfg) ??
      estimateJobSeconds(item, moduleCount, cfg);
    seconds += part;
    if (item.id === video.id) break;
  }

  return Math.max(8, Math.round(seconds));
}

export function formatEta(seconds: number): string {
  if (seconds < 45) return `≈ ${Math.max(8, Math.round(seconds / 5) * 5)} s`;
  if (seconds < 90) return "≈ 1–2 min";
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
  nowMs = Date.now(),
  cfg: PipelineCostConfig = DEFAULT_COST
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

  const until = etaUntilDone(video, all, moduleCount, nowMs, cfg);
  if (until == null) return null;

  if (video.status === "queued") {
    const own = remainingForJob(video, moduleCount, nowMs, cfg) ?? until;
    const wait = Math.max(0, until - own);
    if (wait >= 20) return `En cola · listo en ${formatEta(until)}`;
    return `Estimado ${formatEta(until)}`;
  }

  return `Quedan ${formatEta(until)}`;
}

export function statusIsActive(status: JobStatus) {
  return status === "queued" || status === "processing";
}
