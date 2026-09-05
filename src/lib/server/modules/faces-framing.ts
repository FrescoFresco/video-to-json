import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { extractDenseFrames, readFacesFraming } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const facesFramingModule: ExtractionModuleDefinition = {
  id: "faces_framing",
  title: "Caras y encuadre",
  stage: "Detectando y describiendo caras",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const framesDir = path.join(ctx.workDir, "face-frames");
    const manifestPath = path.join(ctx.workDir, "face-frames.json");
    const outJson = path.join(ctx.workDir, "faces.json");

    try {
      const maxFrames = Number(process.env.FACES_MAX_FRAMES || 16);
      const frames = await extractDenseFrames(
        ctx.videoPath,
        ctx.probe.durationMs,
        framesDir,
        { maxFrames }
      );
      const limited = frames.slice(0, maxFrames);
      const faces = await readFacesFraming(limited, manifestPath, outJson);

      const trackItems = (faces.items || []).filter((i) => i.role === "face");
      const sourceItems = trackItems.length ? trackItems : faces.items || [];
      const items = sourceItems.map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.label || item.role || "cara",
        text: item.text,
      }));

      const dominant = faces.profile?.dominant_shot;
      const count = faces.profile?.face_detections ?? items.length;
      const described = faces.vlm_described || 0;
      const base =
        items.length === 0
          ? "Sin caras"
          : dominant
            ? `${count} cara(s) · ${dominant}`
            : `${count} cara(s)`;
      const summary =
        items.length === 0
          ? base
          : described > 0
            ? `${base} · ${described} descritas`
            : base;

      return {
        id: "faces_framing",
        title: "Caras y encuadre",
        engine: faces.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary,
        items,
        data: faces,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron detectar caras";
      return {
        id: "faces_framing",
        title: "Caras y encuadre",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
