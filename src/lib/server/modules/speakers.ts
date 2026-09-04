import { msToClock } from "@/lib/extraction";
import type { ExtractionModule, VideoSpeech } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

/**
 * Resume quién habla a partir del módulo speech (ya diarizado).
 * No vuelve a transcribir: solo agrupa turnos.
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
        data: { speakers: [], dialogue: [] },
      };
    }

    const bySpeaker = new Map<
      string,
      { id: string; durationMs: number; turns: number; samples: string[] }
    >();

    for (const seg of segments) {
      const id = seg.speaker || "SPEAKER_01";
      const row = bySpeaker.get(id) || { id, durationMs: 0, turns: 0, samples: [] };
      row.durationMs += Math.max(0, (seg.end_ms ?? 0) - (seg.start_ms ?? 0));
      row.turns += 1;
      if (row.samples.length < 2 && seg.text) row.samples.push(seg.text);
      bySpeaker.set(id, row);
    }

    const ranked = [...bySpeaker.values()].sort((a, b) => b.durationMs - a.durationMs);
    const dialogue = segments.map((seg) => ({
      speaker: seg.speaker,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      text: seg.text,
      clock: `${msToClock(seg.start_ms)}–${msToClock(seg.end_ms)}`,
    }));

    return {
      id: "speakers",
      title: "Quién habla",
      engine: data.diarization || data.engine || speech.engine,
      status: "ok",
      summary: ranked.length === 1 ? "1 interlocutor" : `${ranked.length} interlocutores`,
      items: ranked.map((row) => ({
        start_ms: 0,
        end_ms: row.durationMs,
        label: row.id,
        text: `${msToClock(row.durationMs)} · ${row.turns} turnos · «${row.samples[0] || "…"}»`,
      })),
      data: {
        diarization: data.diarization || "diarize-wespeaker",
        speaker_count: ranked.length,
        speakers: ranked.map((r) => ({
          id: r.id,
          duration_ms: r.durationMs,
          turns: r.turns,
          samples: r.samples,
        })),
        dialogue,
      },
    };
  },
};
