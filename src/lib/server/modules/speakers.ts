import { msToClock } from "@/lib/extraction";
import type { ExtractionModule, VideoSpeech } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

type FaceDetection = {
  track_key?: string;
  start_ms?: number;
  end_ms?: number;
  area_ratio?: number;
  score?: number;
  expression_hint?: string | null;
};

type FaceTrack = {
  id?: string;
  description?: string | null;
  dominant_shot?: string;
  mouth_hints?: string[];
  count?: number;
  avg_score?: number;
};

type FacesPayload = {
  tracks?: FaceTrack[];
  detections?: FaceDetection[];
};

type SpeechSegment = VideoSpeech["segments"][number];

function overlapMs(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function looksTalking(hint?: string | null) {
  if (!hint) return false;
  const h = hint.toLowerCase();
  return (
    h.includes("abierta") ||
    h.includes("hablando") ||
    h.includes("speaking") ||
    h.includes("open")
  );
}

/**
 * Empareja cada speaker con la pista de cara más coherente en el tiempo.
 * Prioriza solape, boca abierta y tamaño/confianza. Una cara → un speaker.
 */
export function linkFacesToSpeakers(
  segments: SpeechSegment[],
  faces: FacesPayload | undefined
) {
  const links = new Map<
    string,
    { face_id: string; description: string | null; score: number; overlap_ms: number }
  >();

  const tracks = faces?.tracks || [];
  const detections = faces?.detections || [];
  if (!tracks.length || !detections.length || !segments.length) return links;

  const trackMeta = new Map<string, FaceTrack>();
  for (const t of tracks) {
    if (t.id) trackMeta.set(t.id, t);
  }

  const byTrack = new Map<string, FaceDetection[]>();
  for (const det of detections) {
    const key = det.track_key;
    if (!key) continue;
    const list = byTrack.get(key) || [];
    list.push(det);
    byTrack.set(key, list);
  }

  const speakerIds = [...new Set(segments.map((s) => s.speaker || "SPEAKER_01"))];
  const pairs: Array<{
    speaker: string;
    face_id: string;
    score: number;
    overlap_ms: number;
  }> = [];

  for (const speaker of speakerIds) {
    const segs = segments.filter((s) => (s.speaker || "SPEAKER_01") === speaker);
    for (const [faceId, dets] of byTrack) {
      let score = 0;
      let overlapTotal = 0;
      for (const seg of segs) {
        const s0 = seg.start_ms ?? 0;
        const s1 = seg.end_ms ?? s0;
        for (const det of dets) {
          const d0 = det.start_ms ?? 0;
          const d1 = det.end_ms ?? d0;
          const ov = overlapMs(s0, s1, d0, d1);
          if (ov <= 0) continue;
          overlapTotal += ov;
          let w = ov;
          if (looksTalking(det.expression_hint)) w *= 2.2;
          w *= 1 + Math.min(1, (det.area_ratio || 0) * 8);
          w *= 1 + Math.min(1, det.score || 0);
          score += w;
        }
      }
      if (score > 0) {
        pairs.push({ speaker, face_id: faceId, score, overlap_ms: overlapTotal });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const usedFaces = new Set<string>();
  const usedSpeakers = new Set<string>();

  for (const pair of pairs) {
    if (usedFaces.has(pair.face_id) || usedSpeakers.has(pair.speaker)) continue;
    usedFaces.add(pair.face_id);
    usedSpeakers.add(pair.speaker);
    const meta = trackMeta.get(pair.face_id);
    links.set(pair.speaker, {
      face_id: pair.face_id,
      description: meta?.description || null,
      score: Math.round(pair.score),
      overlap_ms: pair.overlap_ms,
    });
  }

  return links;
}

/**
 * Resume quién habla a partir del módulo speech (ya diarizado)
 * y, si hay caras previas, enlaza interlocutor ↔ rostro en pantalla.
 */
export const speakersModule: ExtractionModuleDefinition = {
  id: "speakers",
  title: "Quién habla",
  stage: "Organizando interlocutores y caras",
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
        data: { speakers: [], dialogue: [], face_links: [] },
      };
    }

    const facesMod = ctx.previousModules.find((m) => m.id === "faces_framing");
    const facesData =
      facesMod && facesMod.status === "ok"
        ? ((facesMod.data || {}) as FacesPayload)
        : undefined;
    const faceLinks = linkFacesToSpeakers(segments, facesData);

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
    const dialogue = segments.map((seg) => {
      const speaker = seg.speaker || "SPEAKER_01";
      const link = faceLinks.get(speaker);
      return {
        speaker,
        start_ms: seg.start_ms,
        end_ms: seg.end_ms,
        text: seg.text,
        clock: `${msToClock(seg.start_ms)}–${msToClock(seg.end_ms)}`,
        face_id: link?.face_id || null,
        face_description: link?.description || null,
      };
    });

    const linkedCount = faceLinks.size;
    const summaryBase =
      ranked.length === 1 ? "1 interlocutor" : `${ranked.length} interlocutores`;
    const summary =
      linkedCount > 0 ? `${summaryBase} · ${linkedCount} con cara` : summaryBase;

    return {
      id: "speakers",
      title: "Quién habla",
      engine: data.diarization || data.engine || speech.engine,
      status: "ok",
      summary,
      items: ranked.map((row) => {
        const link = faceLinks.get(row.id);
        const faceBit = link?.description
          ? ` · cara: ${link.description}`
          : link?.face_id
            ? ` · cara ${link.face_id}`
            : "";
        return {
          start_ms: 0,
          end_ms: row.durationMs,
          label: row.id,
          text: `${msToClock(row.durationMs)} · ${row.turns} turnos · «${row.samples[0] || "…"}»${faceBit}`,
        };
      }),
      data: {
        diarization: data.diarization || "diarize-wespeaker",
        speaker_count: ranked.length,
        faces_linked: linkedCount,
        speakers: ranked.map((r) => {
          const link = faceLinks.get(r.id);
          return {
            id: r.id,
            duration_ms: r.durationMs,
            turns: r.turns,
            samples: r.samples,
            face_id: link?.face_id || null,
            face_description: link?.description || null,
            face_match_score: link?.score ?? null,
            face_overlap_ms: link?.overlap_ms ?? null,
          };
        }),
        face_links: [...faceLinks.entries()].map(([speaker, link]) => ({
          speaker,
          ...link,
        })),
        dialogue,
      },
    };
  },
};
