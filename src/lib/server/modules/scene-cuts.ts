import { msToClock } from "@/lib/extraction";
import type { ExtractionModule } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

/** Cortes de plano a partir del probe (ffmpeg). */
export const sceneCutsModule: ExtractionModuleDefinition = {
  id: "scene_cuts",
  title: "Cortes de plano",
  stage: "Detectando cortes",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const scenes = ctx.probe.scenes;
    const items = scenes.map((scene, index) => ({
      start_ms: scene.startMs,
      end_ms: scene.endMs,
      label: `scene_${String(index + 1).padStart(3, "0")}`,
      text: `${msToClock(scene.startMs)} → ${msToClock(scene.endMs)}`,
    }));

    return {
      id: "scene_cuts",
      title: "Cortes de plano",
      engine: "ffmpeg",
      status: items.length > 0 ? "ok" : "empty",
      summary:
        items.length === 0 ? "Sin cortes" :
        items.length === 1 ? "1 plano" :
        `${items.length} planos`,
      items,
      data: { scenes },
    };
  },
};
