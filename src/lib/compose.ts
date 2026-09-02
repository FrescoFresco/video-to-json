import { denseCafeExtraction, structuralExtraction } from "./demo-extraction";
import type { AudioExtract, ProbeResult, StudioModule } from "./types";

export function pickByPath(obj: unknown, path: string): unknown {
  const raw = path.replace(/^\$sources\./, "");
  const parts = raw.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function treeFrom(value: unknown, prefix = ""): string[] {
  const lines: string[] = [];
  if (Array.isArray(value)) {
    lines.push(`${prefix}[]`);
    if (value.length) lines.push(...treeFrom(value[0], `${prefix}  `));
    return lines;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (Array.isArray(v)) {
        lines.push(`${prefix}${k}[]`);
        if (v.length) lines.push(...treeFrom(v[0], `${prefix}  `));
      } else if (v && typeof v === "object") {
        lines.push(`${prefix}${k}`);
        lines.push(...treeFrom(v, `${prefix}  `));
      } else {
        lines.push(`${prefix}${k}    ${typeof v}`);
      }
    }
    return lines;
  }
  return [`${prefix}${typeof value}`];
}

export function outputsForItem(opts: {
  name: string;
  origin: "file" | "url" | "zip";
  modules: StudioModule[];
  probe?: ProbeResult;
  audio?: AudioExtract | null;
  useFixture: boolean;
}) {
  const moduleOutputs: Record<string, unknown> = {};
  for (const mod of opts.modules.filter((m) => m.enabled)) {
    if (mod.id === "media-probe" && opts.probe) {
      moduleOutputs[mod.id] = {
        duration_ms: opts.probe.durationMs,
        width: opts.probe.width,
        height: opts.probe.height,
        fps: opts.probe.fps,
        video_codec: opts.probe.videoCodec,
        audio_codec: opts.probe.audioCodec,
      };
    } else if (mod.id === "scene-cuts" && opts.probe) {
      moduleOutputs[mod.id] = {
        scenes: opts.probe.scenes.map((s) => ({
          start: s.startMs / 1000,
          end: s.endMs / 1000,
        })),
      };
    } else if (mod.id === "audio-local") {
      moduleOutputs[mod.id] = opts.audio ?? {
        _status: "missing",
        note: "Sube un archivo de vídeo o audio para transcribir.",
      };
    } else if (mod.id === "moss" && opts.audio) {
      moduleOutputs[mod.id] = {
        data: {
          segments: opts.audio.segments.map((s) => ({
            start: s.start,
            end: s.end,
            speaker: s.speaker,
            text: s.text,
          })),
        },
        _note: "Salida local (faster-whisper). El repo MOSS se puede enganchar después.",
      };
    } else if (mod.id === "visual-reconstruction") {
      moduleOutputs[mod.id] = opts.useFixture ?
        {
          data: {
            segments: (
              denseCafeExtraction(opts.name).timeline as {
                start_ms: number;
                end_ms: number;
                dense_caption?: string;
              }[]
            ).map((t) => ({
              start: t.start_ms / 1000,
              end: t.end_ms / 1000,
              description: t.dense_caption,
            })),
          },
        }
      : {
          data: {
            note: "VLM no enganchado. Engancha el repo Qwen2.5-VL para rellenar descriptions.",
            segments: (opts.probe?.scenes ?? []).map((s) => ({
              start: s.startMs / 1000,
              end: s.endMs / 1000,
              description: null,
            })),
          },
        };
    } else if (mod.id === "moss") {
      moduleOutputs[mod.id] = {
        ...((mod.sample as object) || {}),
        _status: mod.status,
        _repo: mod.repoUrl ?? null,
      };
    } else if (!["media-probe", "scene-cuts"].includes(mod.id)) {
      moduleOutputs[mod.id] = {
        ...((mod.sample as object) || {}),
        _status: mod.status,
        _repo: mod.repoUrl ?? null,
      };
    }
  }

  const extraction = opts.useFixture ?
    denseCafeExtraction(opts.name)
  : structuralExtraction({
      filename: opts.name,
      origin: opts.origin,
      probe: opts.probe,
      transcript: opts.audio?.segments.map((s) => ({
        start_ms: s.start_ms,
        end_ms: s.end_ms,
        speaker: s.speaker,
        text: s.text,
      })),
      audioMeta: opts.audio ?
        {
          language: opts.audio.language,
          speakers: opts.audio.speakers,
          diarization: opts.audio.diarization,
        }
      : undefined,
    });

  return { moduleOutputs, extraction };
}
