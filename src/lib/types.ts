export type JobStatus = "queued" | "processing" | "ready" | "error";

export type ViewName =
  | "home"
  | "idea"
  | "videos"
  | "video-detail"
  | "docs"
  | "connections"
  | "settings";

/** Salida cruda de Whisper (interna al módulo speech). */
export type VideoSpeech = {
  engine: string;
  model: string;
  language: string | null;
  language_probability?: number | null;
  speakers: string[];
  speaker_count: number;
  diarization?: string;
  segments: Array<{
    start: number;
    end: number;
    start_ms: number;
    end_ms: number;
    speaker: string;
    text: string;
  }>;
  error?: string;
};

/** Salida cruda de OCR (interna al módulo on_screen_text). */
export type OnScreenText = {
  engine: string;
  backend?: string;
  swap_in?: string;
  repo?: string;
  vision_model?: string | null;
  frame_count: number;
  vlm_described?: number;
  role_counts?: Record<string, number>;
  items: Array<{
    text: string;
    raw_text?: string;
    start_ms: number;
    end_ms: number;
    conf: number;
    bbox?: number[];
    layout?: { cx?: number; cy?: number; w_ratio?: number; h_ratio?: number };
    role?: string;
    description?: string | null;
  }>;
  brands?: string[];
  vlm_error?: string;
  error?: string;
};

export type ActivityEvent = {
  time: string;
  title: string;
  detail: string;
  status: JobStatus;
};

export type ProbeResult = {
  filename: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  videoCodec?: string;
  soundtrackCodec?: string;
  scenes: { startMs: number; endMs: number }[];
  frameCountHint?: number;
};

/** Fila genérica para UI / consumidores: cualquier módulo puede emitirlas. */
export type ModuleItem = {
  start_ms?: number;
  end_ms?: number;
  label?: string;
  text: string;
};

/**
 * Contrato de un módulo de extracción.
 * Añadir otro repo = implementar esto y registrarlo; la UI no conoce el módulo.
 */
export type ExtractionModule = {
  id: string;
  title: string;
  engine?: string | null;
  status: "ok" | "empty" | "error";
  /** Texto corto que define el propio módulo (p. ej. "3 segmentos"). */
  summary: string;
  error?: string;
  items: ModuleItem[];
  /** Tiempo real de ejecución del módulo (ms). */
  duration_ms?: number;
  /** Payload crudo del motor, para APIs / otros sistemas. */
  data?: unknown;
};

export type VideoSourceInput = "upload" | "url" | "folder";

export type VideoExtraction = {
  /** Versión del contrato JSON. Si cambia la forma, sube este número. */
  schema_version: string;
  /** Pack unificado: todos los módulos en un solo documento. */
  kind: "video_complete";
  source: {
    filename: string;
    processed_at: string;
    /** Origen del archivo: subida, link o carpeta vigilada. */
    input?: VideoSourceInput;
    /** Link original si el vídeo se importó por URL (TikTok, YouTube…). */
    url?: string;
  };
  media: {
    duration_ms: number;
    duration: string;
    width: number;
    height: number;
    fps: number;
    video_codec?: string;
    soundtrack_codec?: string;
    orientation: "vertical" | "horizontal" | "square";
  };
  /** Resumen de la corrida (conteos y tiempos por módulo). */
  run: {
    module_count: number;
    ok: number;
    empty: number;
    error: number;
    total_module_ms: number;
    modules: Array<{
      id: string;
      title: string;
      status: ExtractionModule["status"];
      summary: string;
      error?: string;
      engine?: string | null;
      duration_ms?: number;
      item_count: number;
    }>;
  };
  /**
   * Todos los JSON de módulos juntos, por id.
   * Cada entrada lleva meta + `items` + `data` (payload crudo del motor).
   */
  content: Record<string, unknown>;
  /** Todas las filas temporales de todos los módulos, ordenadas por tiempo. */
  timeline: TimelineEvent[];
  /** Lista de módulos (UI / pestañas). Misma info que en `content`, en array. */
  modules: ExtractionModule[];
};

export type TimelineEvent = {
  module_id: string;
  module_title: string;
  start_ms?: number;
  end_ms?: number;
  label?: string;
  text: string;
};

export type StoredVideo = {
  id: string;
  name: string;
  createdAt: string;
  status: JobStatus;
  progress: number;
  stage: string;
  error?: string;
  /** Cómo entró el vídeo al Studio. */
  sourceKind?: VideoSourceInput;
  /** Link original si se importó por URL. */
  sourceUrl?: string;
  /** ISO: cuando empezó el procesado real (para ETA). */
  processingStartedAt?: string;
  /** ISO: cuando terminó (listo o error tras procesar). */
  completedAt?: string;
  /** ISO: cuando cambió el stage actual (módulo en curso). */
  stageStartedAt?: string;
  probe?: ProbeResult;
  extraction?: VideoExtraction;
  activity: ActivityEvent[];
};

export type VideoJobResult = {
  probe: ProbeResult;
  modules: ExtractionModule[];
  extraction: VideoExtraction;
};
