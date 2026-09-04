import { msToClock } from "@/lib/extraction";
import type { ExtractionModule, VideoSpeech } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

type SpeechSegment = VideoSpeech["segments"][number];

/**
 * Quién habla: perfiles, turnos y cambios de interlocutor
 * a partir del speech ya diarizado (no re-transcribe).
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

    const data = (speech.data || {}) as Partial<VideoSpeech> & {
      speaker_stats?: Array<{
        id: string;
        duration_ms: number;
        turns: number;
        chars?: number;
        chars_per_sec?: number;
        samples?: string[];
      }>;
      diarization_segments?: Array<{ start: number; end: number; speaker: string }>;
    };
    const segments = (data.segments || []) as SpeechSegment[];
    if (!segments.length) {
      return {
        id: "speakers",
        title: "Quién habla",
        engine: data.engine || speech.engine,
        status: "empty",
        summary: "Sin interlocutores",
        items: [],
        data: { speakers: [], turns: [], dialogue: [] },
      };
    }

    type Acc = {
      speaker: string;
      durationMs: number;
      turns: number;
      chars: number;
      samples: string[];
    };
    const map = new Map<string, Acc>();
    for (const seg of segments) {
      const spk = seg.speaker || "SPEAKER_01";
      const cur = map.get(spk) || {
        speaker: spk,
        durationMs: 0,
        turns: 0,
        chars: 0,
        samples: [],
      };
      cur.durationMs += Math.max(0, (seg.end_ms ?? 0) - (seg.start_ms ?? 0));
      cur.turns += 1;
      cur.chars += (seg.text || "").length;
      if (cur.samples.length < 3 && seg.text) cur.samples.push(seg.text);
      map.set(spk, cur);
    }

    const ranked = [...map.values()].sort((a, b) => b.durationMs - a.durationMs);
    const totalMs = ranked.reduce((s, r) => s + r.durationMs, 0) || 1;

    // Cambios de interlocutor (para recrear el ritmo del diálogo)
    const handoffs: Array<{
      at_ms: number;
      from: string;
      to: string;
      text_before?: string;
      text_after?: string;
    }> = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const cur = segments[i];
      if ((prev.speaker || "") !== (cur.speaker || "")) {
        handoffs.push({
          at_ms: cur.start_ms,
          from: prev.speaker || "SPEAKER_01",
          to: cur.speaker || "SPEAKER_01",
          text_before: prev.text?.slice(0, 80),
          text_after: cur.text?.slice(0, 80),
        });
      }
    }

    const dialogue = segments.map((seg) => ({
      speaker: seg.speaker,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
      text: seg.text,
      clock: `${msToClock(seg.start_ms)}–${msToClock(seg.end_ms)}`,
    }));

    const items = ranked.map((row) => {
      const share = Math.round((100 * row.durationMs) / totalMs);
      const rate = row.durationMs > 0 ? (row.chars / (row.durationMs / 1000)).toFixed(1) : "0";
      return {
        start_ms: 0,
        end_ms: row.durationMs,
        label: row.speaker,
        text: `${share}% · ${msToClock(row.durationMs)} · ${row.turns} turnos · ${rate} c/s · «${row.samples[0] || "…"}»`,
      };
    });

    if (handoffs.length) {
      items.push({
        start_ms: handoffs[0].at_ms,
        end_ms: handoffs[handoffs.length - 1].at_ms,
        label: "cambios",
        text: `${handoffs.length} cambios de interlocutor`,
      });
    }

    return {
      id: "speakers",
      title: "Quién habla",
      engine: data.diarization || data.engine || speech.engine,
      status: "ok",
      summary:
        ranked.length === 1
          ? "1 interlocutor"
          : `${ranked.length} interlocutores · ${handoffs.length} cambios`,
      items,
      data: {
        diarization: data.diarization || "diarize-wespeaker-v2",
        speaker_count: ranked.length,
        speakers: ranked.map((r) => ({
          id: r.speaker,
          duration_ms: r.durationMs,
          share_pct: Math.round((100 * r.durationMs) / totalMs),
          turns: r.turns,
          chars: r.chars,
          chars_per_sec:
            r.durationMs > 0 ? Math.round((r.chars / (r.durationMs / 1000)) * 10) / 10 : 0,
          samples: r.samples,
        })),
        speaker_stats: data.speaker_stats || null,
        handoffs,
        dialogue,
        turns: dialogue,
      },
    };
  },
};
