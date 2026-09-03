export type JobStatus = "queued" | "processing" | "ready" | "error";

export type ViewName = "home" | "videos" | "video-detail" | "settings";

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

export type VideoExtraction = {
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
  scenes: Array<{
    id: string;
    start_ms: number;
    end_ms: number;
    start: string;
    end: string;
  }>;
  transcript: VideoSpeech["segments"];
  on_screen_text: OnScreenText["items"];
  speakers: string[];
  brands: string[];
  engines: {
    speech: string | null;
    ocr: string | null;
  };
  capabilities: {
    visual_description: { available: false; reason: string };
    object_tracking: { available: false; reason: string };
    music_analysis: { available: false; reason: string };
  };
};

export type StoredVideo = {
  id: string;
  name: string;
  createdAt: string;
  status: JobStatus;
  progress: number;
  stage: string;
  error?: string;
  probe?: ProbeResult;
  speech?: VideoSpeech | null;
  onScreenText?: OnScreenText | null;
  extraction?: VideoExtraction;
  activity: ActivityEvent[];
};
