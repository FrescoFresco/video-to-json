import type {
  ExtractionModule,
  ModuleItem,
  ProbeResult,
  TimelineEvent,
  VideoExtraction,
} from "./types";

/** Versión del contrato `extraction`. Subir al romper compatibilidad. */
export const EXTRACTION_SCHEMA_VERSION = "2.0";

/** Identificadores estables de módulos (orden de salida del pack completo). */
export const COMPLETE_MODULE_IDS = [
  "scene_cuts",
  "camera_motion",
  "speech",
  "faces_framing",
  "speakers",
  "on_screen_text",
  "objects_people",
  "pose_actions",
  "visual_observation",
  "music_ambiance",
  "audio_events",
  "summary",
] as const;

export type CompleteModuleId = (typeof COMPLETE_MODULE_IDS)[number];

export function msToClock(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rem.toFixed(3).padStart(6, "0")}`;
}

function orientationOf(probe: ProbeResult): VideoExtraction["media"]["orientation"] {
  if (probe.height === probe.width) return "square";
  if (probe.height > probe.width) return "vertical";
  return "horizontal";
}

function buildTimeline(modules: ExtractionModule[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const mod of modules) {
    for (const item of mod.items || []) {
      events.push({
        module_id: mod.id,
        module_title: mod.title,
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.label,
        text: item.text,
      });
    }
  }
  events.sort((a, b) => {
    const as = typeof a.start_ms === "number" ? a.start_ms : Number.POSITIVE_INFINITY;
    const bs = typeof b.start_ms === "number" ? b.start_ms : Number.POSITIVE_INFINITY;
    if (as !== bs) return as - bs;
    return a.module_id.localeCompare(b.module_id);
  });
  return events;
}

function buildContentPack(modules: ExtractionModule[]): Record<string, unknown> {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const content: Record<string, unknown> = {};

  for (const id of COMPLETE_MODULE_IDS) {
    const mod = byId.get(id);
    if (!mod) {
      content[id] = null;
      continue;
    }
    // Payload crudo del motor + filas de UI, todo en un bloque por módulo
    content[id] = {
      id: mod.id,
      title: mod.title,
      engine: mod.engine ?? null,
      status: mod.status,
      summary: mod.summary,
      error: mod.error ?? null,
      duration_ms: mod.duration_ms ?? null,
      items: mod.items,
      data: mod.data ?? null,
    };
  }

  // Módulos extra no listados (por si se añaden más adelante)
  for (const mod of modules) {
    if ((COMPLETE_MODULE_IDS as readonly string[]).includes(mod.id)) continue;
    content[mod.id] = {
      id: mod.id,
      title: mod.title,
      engine: mod.engine ?? null,
      status: mod.status,
      summary: mod.summary,
      error: mod.error ?? null,
      duration_ms: mod.duration_ms ?? null,
      items: mod.items,
      data: mod.data ?? null,
    };
  }

  return content;
}

/**
 * Pack completo: un solo JSON con metadatos + todos los módulos juntos + timeline.
 * La UI sigue usando `modules`; la descarga/API expone el documento entero.
 */
export function buildVideoExtraction(input: {
  filename: string;
  processedAt: string;
  probe: ProbeResult;
  modules: ExtractionModule[];
  /** Link original (si vino de URL). */
  sourceUrl?: string | null;
  /** Cómo entró el vídeo. */
  sourceKind?: VideoExtraction["source"]["input"];
}): VideoExtraction {
  const modules = input.modules;
  const ok = modules.filter((m) => m.status === "ok").length;
  const empty = modules.filter((m) => m.status === "empty").length;
  const error = modules.filter((m) => m.status === "error").length;
  const totalDurationMs = modules.reduce((sum, m) => sum + (m.duration_ms || 0), 0);
  const content = buildContentPack(modules);
  const timeline = buildTimeline(modules);
  const url = input.sourceUrl?.trim() || undefined;
  const inputKind = input.sourceKind || (url ? "url" : "upload");

  return {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    kind: "video_complete",
    source: {
      filename: input.filename,
      processed_at: input.processedAt,
      input: inputKind,
      ...(url ? { url } : {}),
    },
    media: {
      duration_ms: input.probe.durationMs,
      duration: msToClock(input.probe.durationMs),
      width: input.probe.width,
      height: input.probe.height,
      fps: input.probe.fps,
      video_codec: input.probe.videoCodec,
      soundtrack_codec: input.probe.soundtrackCodec,
      orientation: orientationOf(input.probe),
    },
    run: {
      module_count: modules.length,
      ok,
      empty,
      error,
      total_module_ms: totalDurationMs,
      modules: modules.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        summary: m.summary,
        error: m.error,
        engine: m.engine ?? null,
        duration_ms: m.duration_ms,
        item_count: m.items.length,
      })),
    },
    // Todos los JSON de módulos juntos (hermanos en el mismo documento)
    content,
    timeline,
    // Compat UI / pestañas
    modules,
  };
}

/** Alias semántico: el JSON de descarga es el pack completo. */
export function buildCompleteExtraction(input: {
  filename: string;
  processedAt: string;
  probe: ProbeResult;
  modules: ExtractionModule[];
  sourceUrl?: string | null;
  sourceKind?: VideoExtraction["source"]["input"];
}): VideoExtraction {
  return buildVideoExtraction(input);
}

/**
 * Sube un extraction 1.0 (solo modules) al pack 2.0 completo.
 * Idempotente si ya es video_complete.
 */
export function ensureCompleteExtraction(
  extraction: Partial<VideoExtraction> | null | undefined
): VideoExtraction | undefined {
  if (!extraction?.modules?.length || !extraction.source || !extraction.media) {
    return undefined;
  }
  if (
    extraction.kind === "video_complete" &&
    extraction.content &&
    extraction.timeline &&
    extraction.run &&
    extraction.schema_version === EXTRACTION_SCHEMA_VERSION
  ) {
    return extraction as VideoExtraction;
  }

  const probe: ProbeResult = {
    filename: extraction.source.filename,
    durationMs: extraction.media.duration_ms,
    width: extraction.media.width,
    height: extraction.media.height,
    fps: extraction.media.fps,
    videoCodec: extraction.media.video_codec,
    soundtrackCodec: extraction.media.soundtrack_codec,
    scenes: [],
  };

  return buildVideoExtraction({
    filename: extraction.source.filename,
    processedAt: extraction.source.processed_at,
    probe,
    modules: extraction.modules,
    sourceUrl: extraction.source.url,
    sourceKind: extraction.source.input,
  });
}

export type { ModuleItem };
