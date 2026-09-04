import path from "node:path";
import { msToClock } from "@/lib/extraction";
import type { ExtractionModule } from "@/lib/types";
import { extractDenseFrames, readRecreationReasoning } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

function moduleSummary(mod: ExtractionModule | undefined) {
  return mod?.status === "ok" ? mod.summary : undefined;
}

function takeTexts(mod: ExtractionModule | undefined, max = 4): string[] {
  if (!mod?.items?.length) return [];
  return mod.items
    .slice(0, max)
    .map((item) => item.text)
    .filter(Boolean) as string[];
}

/**
 * Razonamiento IA para recreación: une hechos ya extraídos + VLM en frames clave.
 * Va justo antes del resumen.
 */
export const aiReasoningModule: ExtractionModuleDefinition = {
  id: "ai_reasoning",
  title: "Razonamiento IA",
  stage: "Razonando cómo recrear el vídeo",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const factsPath = path.join(ctx.workDir, "reason-facts.json");
    const framesDir = path.join(ctx.workDir, "reason-frames");
    const framesManifest = path.join(ctx.workDir, "reason-frames.json");
    const outJson = path.join(ctx.workDir, "reason.json");

    try {
      const byId = new Map(ctx.previousModules.map((m) => [m.id, m]));
      const speakers = byId.get("speakers");
      const speakersData = (speakers?.data || {}) as {
        dialogue?: Array<{
          speaker?: string;
          text?: string;
          start_ms?: number;
          end_ms?: number;
          clock?: string;
        }>;
        handoffs?: unknown[];
      };

      const dialogue = (speakersData.dialogue || []).map((turn) => ({
        speaker: turn.speaker,
        text: turn.text,
        start_ms: turn.start_ms,
        end_ms: turn.end_ms,
        clock:
          turn.clock ||
          (typeof turn.start_ms === "number" ? msToClock(turn.start_ms) : ""),
      }));

      const facts = {
        media: {
          filename: ctx.filename,
          duration_ms: ctx.probe.durationMs,
          duration_clock: msToClock(ctx.probe.durationMs),
          width: ctx.probe.width,
          height: ctx.probe.height,
        },
        speakers: {
          summary: moduleSummary(speakers),
          dialogue,
          handoffs: speakersData.handoffs || [],
        },
        visual: {
          summary: moduleSummary(byId.get("visual_observation")),
          observations: takeTexts(byId.get("visual_observation"), 5),
        },
        faces: { summary: moduleSummary(byId.get("faces_framing")) },
        pose: { summary: moduleSummary(byId.get("pose_actions")) },
        objects: { summary: moduleSummary(byId.get("objects_people")) },
        camera: { summary: moduleSummary(byId.get("camera_motion")) },
        audio: {
          ambiance: moduleSummary(byId.get("music_ambiance")),
          events: moduleSummary(byId.get("audio_events")),
        },
        on_screen_text: {
          texts: takeTexts(byId.get("on_screen_text"), 8),
        },
        speech: { summary: moduleSummary(byId.get("speech")) },
        scenes: { summary: moduleSummary(byId.get("scene_cuts")) },
      };

      const maxFrames = Number(process.env.REASON_MAX_FRAMES || 4);
      const frames = await extractDenseFrames(
        ctx.videoPath,
        ctx.probe.durationMs,
        framesDir,
        { maxFrames }
      );
      const limited = frames.slice(0, maxFrames);

      const reason = await readRecreationReasoning(
        facts,
        factsPath,
        outJson,
        limited,
        framesManifest
      );

      const items = (reason.items || []).map((item) => ({
        start_ms: item.start_ms || 0,
        end_ms: item.end_ms || 0,
        label: item.label || item.role || "razonamiento",
        text: item.text,
      }));

      const gaps = reason.local?.gaps?.length || 0;
      const turns = reason.local?.dialogue_turns || 0;

      return {
        id: "ai_reasoning",
        title: "Razonamiento IA",
        engine: reason.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0
            ? "Sin razonamiento"
            : `${items.length} notas · ${turns} turnos de diálogo${gaps ? ` · ${gaps} huecos` : ""}`,
        items,
        data: reason,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo razonar la recreación";
      return {
        id: "ai_reasoning",
        title: "Razonamiento IA",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
