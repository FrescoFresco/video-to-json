import type { OnScreenText, ProbeResult, VideoExtraction, VideoSpeech } from "./types";

export function buildVideoExtraction(input: {
  filename: string;
  processedAt: string;
  probe: ProbeResult;
  speech?: VideoSpeech | null;
  onScreenText?: OnScreenText | null;
}): VideoExtraction {
  const transcript = input.speech?.segments ?? [];
  const onScreenText = input.onScreenText?.items ?? [];
  const brands = input.onScreenText?.brands ?? [];

  return {
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
    scenes: input.probe.scenes.map((scene, index) => ({
      id: `scene_${String(index + 1).padStart(3, "0")}`,
      start_ms: scene.startMs,
      end_ms: scene.endMs,
      start: msToClock(scene.startMs),
      end: msToClock(scene.endMs),
    })),
    transcript,
    on_screen_text: onScreenText,
    speakers: input.speech?.speakers ?? [],
    brands,
    engines: {
      speech: input.speech?.engine ?? null,
      ocr: input.onScreenText?.engine ?? null,
    },
    capabilities: {
      visual_description: {
        available: false,
        reason: "Esta versión aún no describe lo que se ve en el plano.",
      },
      object_tracking: {
        available: false,
        reason: "Esta versión aún no sigue objetos o personas en el tiempo.",
      },
      music_analysis: {
        available: false,
        reason: "Esta versión aún no identifica música o ambiente sonoro.",
      },
    },
  };
}

export function msToClock(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rem.toFixed(3).padStart(6, "0")}`;
}
