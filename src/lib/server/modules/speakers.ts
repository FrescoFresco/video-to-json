import { msToClock } from "@/lib/extraction";
import type { ExtractionModule, VideoSpeech } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

/**
 * Resume quién habla a partir del módulo speech (no re-transcribe).
 */
export const speakersModule: ExtractionModuleDefinition = {
  id: "speakers",
  title: "Quién habla",
  stage: "Organizando interlocutores",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const speech = ctx.previousModules.find((m) => m.id === "speech");
    if (!speech || speech.status === "error") {
      return {
        id: "speakers",
        title: "Quién habla",
        engine: speech?.engine ?? null,
        status: "empty",
        summary: speech?.status === "error" ? "Sin habla usable" : "Sin datos de habla",
        error: speech?.error,
        items: [],
      };
    }

    const data = (speech.data || {}) as Partial<VideoSpeech>;
    const segments = data.segments || [];
    if (!segments.length) {
      return {
        id: "speakers",
        title: "Quién habla",
        engine: data.engine || speech.engine,
        status: "empty",
        summary: "Sin interlocutores",
        items: [],
        data: { speakers: [], turns: [] },
      };
    }

    type Acc = {
      speaker: string;
      durationMs: number;
      turns: number;
      samples: string[];
    };
    const map = new Map<string, Acc>();
    for (const seg of segments) {
      const spk = seg.speaker || "SPEAKER_01";
      const cur = map.get(spk) || { speaker: spk, durationMs: 0, turns: 0, samples: [] };
      cur.durationMs += Math.max(0, (seg.end_ms ?? 0) - (seg.start_ms ?? 0));
      cur.turns += 1;
      if (cur.samples.length < 2 && seg.text) cur.samples.push(seg.text);
      map.set(spk, cur);
    }

    const ranked = [...map.values()].sort((a, b) => b.durationMs - a.durationMs);
    const items = ranked.map((row) => ({
      start_ms: 0,
      end_ms: row.durationMs,
      label: row.speaker,
      text: `${msToClock(row.durationMs)} · ${row.turns} turnos · «${row.samples[0] || "…"}»`,
    }));

    return {
      id: "speakers",
      title: "Quién habla",
      engine: data.diarization || data.engine || speech.engine,
      status: "ok",
      summary:
        ranked.length === 1 ? "1 interlocutor" : `${ranked.length} interlocutores`,
      items,
      data: {
        diarization: data.diarization || "spectral-pitch-clustering",
        speaker_count: ranked.length,
        speakers: ranked.map((r) => ({
          id: r.speaker,
          duration_ms: r.durationMs,
          turns: r.turns,
          samples: r.samples,
        })),
        turns: segments.map((seg) => ({
          speaker: seg.speaker,
          start_ms: seg.start_ms,
          end_ms: seg.end_ms,
          text: seg.text,
        })),
      },
    };
  },
};
