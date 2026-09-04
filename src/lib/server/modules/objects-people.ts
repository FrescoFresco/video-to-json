import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { extractDenseFrames, readObjectDetections } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const objectsPeopleModule: ExtractionModuleDefinition = {
  id: "objects_people",
  title: "Objetos y personas",
  stage: "Detectando objetos y personas",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const framesDir = path.join(ctx.workDir, "object-frames");
    const manifestPath = path.join(ctx.workDir, "object-frames.json");
    const outJson = path.join(ctx.workDir, "objects.json");

    try {
      const maxFrames = Number(process.env.OBJECTS_MAX_FRAMES || 12);
      const frames = await extractDenseFrames(
        ctx.videoPath,
        ctx.probe.durationMs,
        framesDir,
        { maxFrames }
      );
      const limited = frames.slice(0, maxFrames);
      const detected = await readObjectDetections(limited, manifestPath, outJson);
      const items = (detected.items || []).map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.role || item.label || "objeto",
        text: item.text,
      }));

      const counts = detected.class_counts || {};
      const countBits = Object.entries(counts)
        .slice(0, 4)
        .map(([k, v]) => `${v}× ${k}`)
        .join(", ");

      return {
        id: "objects_people",
        title: "Objetos y personas",
        engine: detected.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0 ? "Nada detectado" :
          countBits || `${items.length} pistas`,
        items,
        data: detected,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron detectar objetos/personas";
      return {
        id: "objects_people",
        title: "Objetos y personas",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
