export type JobStatus = "queued" | "processing" | "ready" | "error";

export type SourceKind = "file" | "url" | "zip";

export type ModuleKind = "builtin" | "repo";

export type ModuleStatus = "ready" | "unwired" | "error";

export type StudioModule = {
  id: string;
  name: string;
  kind: ModuleKind;
  category: "Vision" | "Video" | "Speech" | "Custom";
  repoUrl?: string;
  description: string;
  enabled: boolean;
  status: ModuleStatus;
  sample: unknown;
};

export type BatchItem = {
  id: string;
  name: string;
  type: SourceKind;
  progress: number;
  status: JobStatus;
  stage: string;
  videoId?: string;
};

export type Batch = {
  id: string;
  number: number;
  status: "processing" | "complete";
  items: BatchItem[];
};

export type StoredVideo = {
  id: string;
  name: string;
  origin: SourceKind;
  createdAt: string;
  status: JobStatus;
  meta: string;
  durationMs?: number;
  extraction: Record<string, unknown>;
  moduleOutputs: Record<string, unknown>;
  activity: ActivityEvent[];
};

export type ActivityEvent = {
  time: string;
  title: string;
  meta: string;
  status: JobStatus;
  error?: unknown;
};

export type OutputConfig = {
  config_id: string;
  version: string;
  name: string;
  output: Record<string, string>;
};

export type ConfigVersion = {
  version: string;
  date: string;
  current: boolean;
  config: OutputConfig;
};

export type ViewName =
  | "home"
  | "videos"
  | "video-detail"
  | "modules"
  | "composer"
  | "settings";

/** Speech detected inside a video. Not a standalone audio product. */
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
