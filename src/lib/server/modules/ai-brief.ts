import path from "node:path";
import { msToClock } from "@/lib/extraction";
import type { ExtractionModule } from "@/lib/types";
import { extractDenseFrames, readAiBrief } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

function summaryOf(mod: ExtractionModule | undefined) {
  return mod?.status === "ok" ? mod.summary : undefined;
}

function textsOf(mod: ExtractionModule | undefined, max = 4) {
  if (!mod?.items?.length) return [];
  return mod.items.slice(0, max).map((i) => i.text).filter(Boolean) as string[];
}

/**
 * IA de recreación: toma hechos ya medidos + fotogramas y escribe el brief.
 * No sustituye ASR/diarización/CV; los usa como ancla.
 */
export const aiBriefModule: ExtractionModuleDefinition = {
  id: "ai_brief",
  title: "Brief IA",
  stage: "Generando brief de recreación con IA",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const factsPath = path.join(ctx.workDir, "ai-brief-facts.json");
    const framesDir = path.join(ctx.workDir, "ai-brief-frames");
    const framesManifest = path.join(ctx.workDir, "ai-brief-frames.json");
    const outJson = path.join(ctx.workDir, "ai-brief.json");

    try {
      const byId = new Map(ctx.previousModules.map((m) => [m.id, m]));
      const speakers = byId.get("speakers");
      const dialogue =
        (
          (speakers?.data as {
            dialogue?: Array<{ speaker?: string; text?: string; clock?: string }>;
          }) || {}
        ).dialogue || [];

      const facts = {
        media: {
          filename: ctx.filename,
          duration_ms: ctx.probe.durationMs,
          duration_clock: msToClock(ctx.probe.durationMs),
          width: ctx.probe.width,
          height: ctx.probe.height,
        },
        speakers: {
          summary: summaryOf(speakers),
          dialogue: dialogue.slice(0, 16),
        },
        visual: {
          summary: summaryOf(byId.get("visual_observation")),
          observations: textsOf(byId.get("visual_observation"), 4),
        },
        objects: { summary: summaryOf(byId.get("objects_people")) },
        faces: { summary: summaryOf(byId.get("faces_framing")) },
        pose: { summary: summaryOf(byId.get("pose_actions")) },
        camera: { summary: summaryOf(byId.get("camera_motion")) },
        audio: {
          summary: summaryOf(byId.get("music_ambiance")),
          events: summaryOf(byId.get("audio_events")),
        },
        on_screen_text: { texts: textsOf(byId.get("on_screen_text"), 6) },
        speech: { summary: summaryOf(byId.get("speech")) },
      };

      const maxFrames = Number(process.env.AI_BRIEF_MAX_FRAMES || 4);
      const frames = await extractDenseFrames(
        ctx.videoPath,
        ctx.probe.durationMs,
        framesDir,
        { maxFrames }
      );

      const brief = await readAiBrief(
        facts,
        factsPath,
        outJson,
        frames.slice(0, maxFrames),
        framesManifest
      );

      const items = (brief.items || []).map((item) => ({
        start_ms: item.start_ms || 0,
        end_ms: item.end_ms || 0,
        label: item.label || "brief",
        text: item.text,
      }));

      return {
        id: "ai_brief",
        title: "Brief IA",
        engine: brief.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0
            ? "Sin brief"
            : `${items.length} notas de recreación`,
        items,
        data: brief,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo generar el brief IA";
      return {
        id: "ai_brief",
        title: "Brief IA",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
