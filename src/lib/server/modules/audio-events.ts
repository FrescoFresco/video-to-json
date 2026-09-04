import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { analyzeAudioEvents } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

/** Qué tipo de sonidos hay (habla, música, aplausos…) con PANNs. */
export const audioEventsModule: ExtractionModuleDefinition = {
  id: "audio_events",
  title: "Eventos de audio",
  stage: "Detectando eventos de audio",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const wavPath = path.join(ctx.workDir, "audio-events.wav");
    const outJson = path.join(ctx.workDir, "audio-events.json");

    try {
      const events = await analyzeAudioEvents(ctx.videoPath, wavPath, outJson);
      if (events.error) {
        return {
          id: "audio_events",
          title: "Eventos de audio",
          engine: events.engine || "panns-cnn14",
          status: "error",
          summary: "Error",
          error: events.error,
          items: [],
          data: events,
        };
      }

      const items = (events.items || []).map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.label,
        text: item.text,
      }));

      const top = (events.top_tags || [])
        .slice(0, 3)
        .map((t) => t.label_es)
        .join(", ");

      return {
        id: "audio_events",
        title: "Eventos de audio",
        engine: events.engine || "panns-cnn14",
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0
            ? events.profile?.overall || "Sin eventos claros"
            : top || events.profile?.overall || `${items.length} ventanas`,
        items,
        data: events,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron detectar eventos de audio";
      return {
        id: "audio_events",
        title: "Eventos de audio",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
