export type JobStatus = "queued" | "processing" | "ready" | "error";

export type SourceKind = "file" | "url" | "zip";

export type ModuleKind = "builtin" | "repo";

export type ModuleStatus = "ready" | "unwired" | "error";

export type StudioModule = {
  id: string;
  name: string;
  kind: ModuleKind;
  category: "Audio" | "Vision" | "Video" | "Music" | "Media" | "Custom";
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

export type ProbeResult = {
  filename: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  videoCodec?: string;
  audioCodec?: string;
  scenes: { startMs: number; endMs: number }[];
  frameCountHint?: number;
};
