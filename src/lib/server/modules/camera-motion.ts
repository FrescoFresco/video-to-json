import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { analyzeCameraMotion } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

/** Cómo se mueve la cámara: estática, paneo, zoom, trepidación. */
export const cameraMotionModule: ExtractionModuleDefinition = {
  id: "camera_motion",
  title: "Movimiento de cámara",
  stage: "Analizando movimiento de cámara",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const outJson = path.join(ctx.workDir, "camera.json");

    try {
      const camera = await analyzeCameraMotion(ctx.videoPath, outJson);
      if (camera.error) {
        return {
          id: "camera_motion",
          title: "Movimiento de cámara",
          engine: camera.engine || "opencv-farneback",
          status: "error",
          summary: "Error",
          error: camera.error,
          items: [],
          data: camera,
        };
      }

      const items = (camera.items || []).map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.label,
        text: item.text,
      }));

      return {
        id: "camera_motion",
        title: "Movimiento de cámara",
        engine: camera.engine || "opencv-farneback",
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0
            ? camera.profile?.overall || "Sin movimiento analizable"
            : camera.profile?.overall ||
              camera.profile?.dominant ||
              `${items.length} tramos`,
        items,
        data: camera,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo analizar el movimiento de cámara";
      return {
        id: "camera_motion",
        title: "Movimiento de cámara",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
