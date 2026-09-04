export type JobStatus = "queued" | "processing" | "ready" | "error";

export type ViewName = "home" | "videos" | "video-detail" | "docs" | "settings";

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
  frame_count: number;
  items: Array<{
    text: string;
    start_ms: number;
    end_ms: number;
    conf: number;
    bbox?: number[];
    role?: string;
  }>;
  brands?: string[];
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
  /** Payload crudo del motor, para APIs / otros sistemas. */
  data?: unknown;
};

export type VideoExtraction = {
  /** Versión del contrato JSON. Si cambia la forma, sube este número. */
  schema_version: string;
  source: {
    filename: string;
    processed_at: string;
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
  /** Solo módulos que se ejecutaron. Si no está instalado, no aparece. */
  modules: ExtractionModule[];
};

export type StoredVideo = {
  id: string;
  name: string;
  createdAt: string;
  status: JobStatus;
  progress: number;
  stage: string;
  error?: string;
  /** ISO: cuando empezó el procesado real (para ETA). */
  processingStartedAt?: string;
  /** ISO: cuando terminó (listo o error tras procesar). */
  completedAt?: string;
  probe?: ProbeResult;
  extraction?: VideoExtraction;
  activity: ActivityEvent[];
};

export type VideoJobResult = {
  probe: ProbeResult;
  modules: ExtractionModule[];
  extraction: VideoExtraction;
};
