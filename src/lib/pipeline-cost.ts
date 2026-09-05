/**
 * Modelo de coste real del pipeline de extracción (ETA).
 *
 * Calibrado contra el comportamiento real de los scripts:
 * - Whisper + diarize: escalan con la duración del vídeo
 * - CV/VLM: muestreo denso con tope de frames (no fps continuo)
 * - Moondream se carga de nuevo en cada script Python (caras, OCR,
 *   objetos, pose, visual) → loadSec se paga varias veces
 * - visual_observation: caption + prompt + 6 queries por frame
 *
 * Números = wall-clock aproximado en CPU (sin CUDA), cloud VM típica.
 */

export type CostConfig = {
  whisperModel: string;
  facesVlm: boolean;
  objectsVlm: boolean;
  poseVlm: boolean;
  ocrVlm: boolean;
  facesMaxFrames: number;
  objectsMaxFrames: number;
  poseMaxFrames: number;
  ocrMaxFrames: number;
  visionMaxFrames: number;
  cameraMaxFrames: number;
  denseIntervalMs: number;
  /** Segundos wall por llamada Moondream en CPU. */
  vlmSecPerCall: number;
  /** Segundos por frame ffmpeg (-ss + 1 jpg). */
  ffmpegSecPerFrame: number;
};

function envOn(
  env: Record<string, string | undefined>,
  key: string,
  fallback = true,
): boolean {
  const v = (env[key] ?? (fallback ? "1" : "0")).trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

function envInt(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  const n = Number(env[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function costConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): CostConfig {
  return {
    whisperModel: (env.WHISPER_MODEL ?? "large-v3").trim() || "large-v3",
    facesVlm: envOn(env, "FACES_VLM", true),
    objectsVlm: envOn(env, "OBJECTS_VLM", true),
    poseVlm: envOn(env, "POSE_VLM", true),
    ocrVlm: envOn(env, "OCR_VLM", true),
    facesMaxFrames: envInt(env, "FACES_MAX_FRAMES", 16),
    objectsMaxFrames: envInt(env, "OBJECTS_MAX_FRAMES", 12),
    poseMaxFrames: envInt(env, "POSE_MAX_FRAMES", 16),
    ocrMaxFrames: envInt(env, "OCR_MAX_FRAMES", 16),
    visionMaxFrames: envInt(env, "VISION_MAX_FRAMES", 8),
    cameraMaxFrames: envInt(env, "CAMERA_MAX_FRAMES", 48),
    denseIntervalMs: envInt(env, "DENSE_INTERVAL_MS", 1200),
    vlmSecPerCall: 2.6,
    ffmpegSecPerFrame: 0.55,
  };
}

/** Defaults de cliente (sin process.env). */
export const DEFAULT_COST: CostConfig = costConfigFromEnv({});

/** Alias usados por eta.ts / UI. */
export type PipelineCostConfig = CostConfig;
export function defaultCostConfig(
  env?: Record<string, string | undefined>,
): CostConfig {
  return env ? costConfigFromEnv(env) : { ...DEFAULT_COST };
}

/** Factor wall-clock Whisper (segundos de proceso / segundo de vídeo), CPU int8. */
function whisperRate(model: string): number {
  const m = model.toLowerCase();
  if (m.includes("tiny")) return 0.4;
  if (m.includes("base")) return 0.85;
  if (m.includes("small")) return 1.6;
  if (m.includes("medium")) return 3.5;
  if (m.includes("turbo")) return 2.8;
  if (m.includes("large")) return 7.2;
  return 7.2;
}

/**
 * Misma lógica que extractDenseFrames en media.ts:
 * step = max(interval, duration/maxFrames) → count ≤ maxFrames.
 */
export function denseFrameCount(
  durationSec: number,
  maxFrames: number,
  intervalMs: number,
): number {
  const durationMs = Math.max(1, durationSec * 1000);
  const max = Math.max(2, maxFrames);
  const interval = Math.max(400, intervalMs);
  const step = Math.max(interval, Math.round(durationMs / max) || interval);
  let n = 0;
  for (let t = 0; t < durationMs && n < max; t += step) n += 1;
  return Math.max(1, n);
}

export type ModuleCostEstimate = {
  id: string;
  stage: string;
  seconds: number;
};

export type JobCostBreakdown = {
  totalSec: number;
  probeSec: number;
  composeSec: number;
  modules: ModuleCostEstimate[];
};

/** Stage strings exactos de EXTRACTION_MODULES (para mapear video.stage → índice). */
export const MODULE_STAGES: { id: string; stage: string }[] = [
  { id: "scene_cuts", stage: "Detectando cortes" },
  { id: "camera_motion", stage: "Analizando movimiento de cámara" },
  { id: "speech", stage: "Transcribiendo habla" },
  { id: "faces_framing", stage: "Detectando y describiendo caras" },
  { id: "speakers", stage: "Organizando interlocutores y caras" },
  { id: "on_screen_text", stage: "Leyendo y clasificando texto en pantalla" },
  { id: "objects_people", stage: "Detectando y describiendo objetos" },
  { id: "pose_actions", stage: "Estimando y describiendo pose" },
  { id: "visual_observation", stage: "Observando el vídeo con IA" },
  { id: "music_ambiance", stage: "Analizando música y ambiente" },
  { id: "audio_events", stage: "Detectando eventos de audio" },
  { id: "summary", stage: "Componiendo resumen" },
];

export function findModuleIndexByStage(stage: string): number {
  const s = (stage || "").trim();
  if (!s) return -1;
  const exact = MODULE_STAGES.findIndex((m) => m.stage === s);
  if (exact >= 0) return exact;
  // Prefijos / variantes suaves
  const lower = s.toLowerCase();
  return MODULE_STAGES.findIndex(
    (m) =>
      lower.includes(m.stage.toLowerCase().slice(0, 12)) ||
      m.stage.toLowerCase().includes(lower.slice(0, 12)),
  );
}

function estimateModuleSeconds(
  id: string,
  durationSec: number,
  cfg: CostConfig,
): number {
  const d = Math.max(0.5, durationSec);
  const vlm = cfg.vlmSecPerCall;
  const ff = cfg.ffmpegSecPerFrame;
  const interval = cfg.denseIntervalMs;

  switch (id) {
    case "scene_cuts":
      // Solo lee probe.scenes (ya calculado).
      return 0.4;

    case "camera_motion": {
      const frames = Math.min(
        cfg.cameraMaxFrames,
        Math.max(8, Math.ceil(d / 0.8)),
      );
      return 3 + frames * 0.12;
    }

    case "speech": {
      // Carga Whisper + decode + word timestamps + diarize (WeSpeaker).
      const load = 22;
      const decode = whisperRate(cfg.whisperModel) * d;
      const diarize = 18 + 0.85 * d;
      const wavExtract = 2 + 0.05 * d;
      return load + decode + diarize + wavExtract;
    }

    case "faces_framing": {
      const frames = denseFrameCount(d, cfg.facesMaxFrames, interval);
      const extract = frames * ff;
      const yunet = 2 + frames * 0.12;
      // ~0.9 caras/frame → tracks ≈ min(frames*0.55, 8)
      const tracks = Math.min(8, Math.max(1, Math.round(frames * 0.55)));
      const moondreamLoad = cfg.facesVlm ? 28 : 0;
      const describe = cfg.facesVlm ? tracks * vlm : 0;
      return extract + yunet + moondreamLoad + describe;
    }

    case "speakers":
      // Matching JS cara↔voz sobre segmentos ya extraídos.
      return 1.2;

    case "on_screen_text": {
      const frames = denseFrameCount(d, cfg.ocrMaxFrames, interval);
      const extract = frames * ff;
      const ocr = 3 + frames * 0.45;
      // Textos únicos tras merge ≈ 0.4 / frame (mucho 0 en talking-head)
      const unique = Math.max(0, Math.round(frames * 0.4));
      const moondreamLoad = cfg.ocrVlm && unique > 0 ? 28 : 0;
      const describe = cfg.ocrVlm ? unique * vlm : 0;
      return extract + ocr + moondreamLoad + describe;
    }

    case "objects_people": {
      const frames = denseFrameCount(d, cfg.objectsMaxFrames, interval);
      const extract = frames * ff;
      const yoloLoad = 6;
      const yoloRun = frames * 0.55;
      // Tracks únicos (grid espacial) ≈ 1.8 / frame típico, tope blando
      const tracks = Math.min(24, Math.max(2, Math.round(frames * 1.8)));
      const moondreamLoad = cfg.objectsVlm ? 28 : 0;
      const describe = cfg.objectsVlm ? tracks * vlm : 0;
      return extract + yoloLoad + yoloRun + moondreamLoad + describe;
    }

    case "pose_actions": {
      const frames = denseFrameCount(d, cfg.poseMaxFrames, interval);
      const extract = frames * ff;
      const poseLoad = 7;
      const poseRun = frames * 0.7;
      const persons = Math.min(12, Math.max(1, Math.round(frames * 1.1)));
      const moondreamLoad = cfg.poseVlm ? 28 : 0;
      const describe = cfg.poseVlm ? persons * vlm : 0;
      return extract + poseLoad + poseRun + moondreamLoad + describe;
    }

    case "visual_observation": {
      // Moondream: 1 caption + 1 detail + 6 recreation queries = 8 calls/frame
      const frames = denseFrameCount(d, cfg.visionMaxFrames, interval);
      const extract = frames * ff;
      const load = 30;
      const callsPerFrame = 8;
      const encodeOverhead = frames * 0.4;
      return extract + load + encodeOverhead + frames * callsPerFrame * vlm;
    }

    case "music_ambiance":
      return 4 + 0.18 * d;

    case "audio_events":
      return 5 + 0.14 * d;

    case "summary":
      return 0.8;

    default:
      return 5;
  }
}

export function estimateJobBreakdown(
  durationSec: number,
  cfg: CostConfig = DEFAULT_COST,
): JobCostBreakdown {
  const probeSec = 4 + Math.min(8, durationSec * 0.02);
  const composeSec = 1.5;
  const modules: ModuleCostEstimate[] = MODULE_STAGES.map(({ id, stage }) => ({
    id,
    stage,
    seconds: estimateModuleSeconds(id, durationSec, cfg),
  }));
  const modulesTotal = modules.reduce((s, m) => s + m.seconds, 0);
  return {
    totalSec: probeSec + modulesTotal + composeSec,
    probeSec,
    composeSec,
    modules,
  };
}

export function estimatePipelineSeconds(
  durationSec: number,
  cfg: CostConfig = DEFAULT_COST,
): { total: number; byId: Record<string, number>; ordered: ModuleCostEstimate[] } {
  const b = estimateJobBreakdown(durationSec, cfg);
  const byId: Record<string, number> = {};
  for (const m of b.modules) byId[m.id] = m.seconds;
  return { total: b.totalSec, byId, ordered: b.modules };
}

/** Progreso 0–100 al empezar el módulo `moduleIndex` (tras probe). */
export function progressAtModuleStart(
  moduleIndex: number,
  durationSec: number,
  cfg: CostConfig = DEFAULT_COST,
): number {
  const b = estimateJobBreakdown(durationSec, cfg);
  if (b.totalSec <= 0) return 12;
  let done = b.probeSec;
  for (let i = 0; i < moduleIndex && i < b.modules.length; i++) {
    done += b.modules[i].seconds;
  }
  return Math.min(94, Math.max(12, Math.round((100 * done) / b.totalSec)));
}

/** Progreso tras completar el módulo `moduleIndex`. */
export function progressAfterModule(
  moduleIndex: number,
  durationSec: number,
  cfg: CostConfig = DEFAULT_COST,
): number {
  const b = estimateJobBreakdown(durationSec, cfg);
  if (b.totalSec <= 0) return 95;
  let done = b.probeSec;
  for (let i = 0; i <= moduleIndex && i < b.modules.length; i++) {
    done += b.modules[i].seconds;
  }
  return Math.min(94, Math.max(14, Math.round((100 * done) / b.totalSec)));
}

/** Resumen legible para /api/modules (debug / UI). */
export function costSummaryForDuration(
  durationSec: number,
  cfg: CostConfig = DEFAULT_COST,
): {
  durationSec: number;
  totalSec: number;
  modules: Array<{ id: string; stage: string; seconds: number; pct: number }>;
} {
  const b = estimateJobBreakdown(durationSec, cfg);
  return {
    durationSec,
    totalSec: Math.round(b.totalSec),
    modules: b.modules.map((m) => ({
      id: m.id,
      stage: m.stage,
      seconds: Math.round(m.seconds),
      pct: Math.round((100 * m.seconds) / Math.max(1, b.totalSec)),
    })),
  };
}
