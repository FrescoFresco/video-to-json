import type { ExtractionModule, ProbeResult, VideoExtraction } from "./types";

/** Versión del contrato `extraction`. Subir al romper compatibilidad. */
export const EXTRACTION_SCHEMA_VERSION = "1.0";

export function msToClock(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rem.toFixed(3).padStart(6, "0")}`;
}

export function buildVideoExtraction(input: {
  filename: string;
  processedAt: string;
  probe: ProbeResult;
  modules: ExtractionModule[];
}): VideoExtraction {
  return {
    schema_version: EXTRACTION_SCHEMA_VERSION,
    source: {
      filename: input.filename,
      processed_at: input.processedAt,
    },
    media: {
      duration_ms: input.probe.durationMs,
      duration: msToClock(input.probe.durationMs),
      width: input.probe.width,
      height: input.probe.height,
      fps: input.probe.fps,
      video_codec: input.probe.videoCodec,
      soundtrack_codec: input.probe.soundtrackCodec,
      orientation:
        input.probe.height === input.probe.width ? "square" :
        input.probe.height > input.probe.width ? "vertical"
        : "horizontal",
    },
    modules: input.modules,
  };
}
