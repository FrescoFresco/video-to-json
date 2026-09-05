import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { transcribeVideoSpeech } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const speechModule: ExtractionModuleDefinition = {
  id: "speech",
  title: "Habla",
  stage: "Transcribiendo habla",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const wavPath = path.join(ctx.workDir, "audio.wav");
    const outJson = path.join(ctx.workDir, "speech.json");

    try {
      const speech = await transcribeVideoSpeech(ctx.videoPath, wavPath, outJson);
      const items = speech.segments.map((segment) => ({
        start_ms: segment.start_ms,
        end_ms: segment.end_ms,
        label: segment.speaker,
        text: segment.text,
      }));

      return {
        id: "speech",
        title: "Habla",
        engine: speech.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0 ? "Sin habla detectada" :
          items.length === 1 ? "1 segmento" :
          `${items.length} segmentos`,
        items,
        data: speech,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el habla del vídeo";
      return {
        id: "speech",
        title: "Habla",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
