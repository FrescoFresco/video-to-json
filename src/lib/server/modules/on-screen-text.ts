import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { extractDenseFrames, readOnScreenText } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const onScreenTextModule: ExtractionModuleDefinition = {
  id: "on_screen_text",
  title: "Texto en pantalla",
  stage: "Leyendo y clasificando texto en pantalla",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const framesDir = path.join(ctx.workDir, "ocr-frames");
    const manifestPath = path.join(ctx.workDir, "ocr-frames.json");
    const outJson = path.join(ctx.workDir, "ocr.json");

    try {
      const maxFrames = Number(process.env.OCR_MAX_FRAMES || 16);
      const frames = await extractDenseFrames(
        ctx.videoPath,
        ctx.probe.durationMs,
        framesDir,
        { maxFrames }
      );
      const limited = frames.slice(0, maxFrames);
      const ocr = await readOnScreenText(limited, manifestPath, outJson);
      const items = (ocr.items || []).map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.role || "texto",
        text: item.text,
      }));

      const roles = ocr.role_counts || {};
      const roleBits = Object.entries(roles)
        .slice(0, 3)
        .map(([k, v]) => `${v}× ${k}`)
        .join(", ");
      const described = ocr.vlm_described || 0;
      const base =
        items.length === 0
          ? "Sin texto detectado"
          : roleBits ||
            (items.length === 1 ? "1 detección" : `${items.length} detecciones`);
      const summary =
        items.length === 0
          ? base
          : described > 0
            ? `${base} · ${described} con contexto`
            : base;

      return {
        id: "on_screen_text",
        title: "Texto en pantalla",
        engine: ocr.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary,
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
