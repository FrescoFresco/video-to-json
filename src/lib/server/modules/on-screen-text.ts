import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { extractSceneFrames, readOnScreenText } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const onScreenTextModule: ExtractionModuleDefinition = {
  id: "on_screen_text",
  title: "Texto en pantalla",
  stage: "Leyendo texto en pantalla",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const framesDir = path.join(ctx.workDir, "frames");
    const manifestPath = path.join(ctx.workDir, "frames.json");
    const outJson = path.join(ctx.workDir, "ocr.json");

    try {
      const frames = await extractSceneFrames(
        ctx.videoPath,
        ctx.probe.scenes,
        ctx.probe.durationMs,
        framesDir
      );
      const ocr = await readOnScreenText(frames, manifestPath, outJson);
      const items = ocr.items.map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label:
          item.role ||
          (typeof item.conf === "number" ? `conf ${item.conf.toFixed(2)}` : "texto"),
        text: item.text,
      }));

      return {
        id: "on_screen_text",
        title: "Texto en pantalla",
        engine: ocr.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0 ? "Sin texto detectado" :
          items.length === 1 ? "1 detección" :
          `${items.length} detecciones`,
        items,
        data: ocr,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo leer el texto en pantalla";
      return {
        id: "on_screen_text",
        title: "Texto en pantalla",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
