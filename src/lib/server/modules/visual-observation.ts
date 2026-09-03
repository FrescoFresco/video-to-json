import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { extractSceneFrames, readVisualObservations } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const visualObservationModule: ExtractionModuleDefinition = {
  id: "visual_observation",
  title: "Observación visual",
  stage: "Observando el vídeo con IA",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const framesDir = path.join(ctx.workDir, "visual-frames");
    const manifestPath = path.join(ctx.workDir, "visual-frames.json");
    const outJson = path.join(ctx.workDir, "visual.json");

    try {
      const frames = await extractSceneFrames(
        ctx.videoPath,
        ctx.probe.scenes,
        ctx.probe.durationMs,
        framesDir
      );
      // CPU: pocas observaciones; el script también limita.
      const limited = frames.slice(0, Number(process.env.VISION_MAX_FRAMES || 6));
      const visual = await readVisualObservations(limited, manifestPath, outJson);
      const items = (visual.items || []).map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.role || "visión",
        text: item.text,
      }));

      return {
        id: "visual_observation",
        title: "Observación visual",
        engine: visual.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0 ? "Sin observaciones" :
          items.length === 1 ? "1 observación" :
          `${items.length} observaciones`,
        items,
        data: visual,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo observar el vídeo visualmente";
      return {
        id: "visual_observation",
        title: "Observación visual",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
