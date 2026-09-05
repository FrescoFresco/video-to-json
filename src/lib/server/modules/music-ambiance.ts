import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { analyzeVideoAmbiance } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

/** Cómo suena el vídeo: energía, ritmo, brillo. Sin identificar canciones. */
export const musicAmbianceModule: ExtractionModuleDefinition = {
  id: "music_ambiance",
  title: "Música y ambiente",
  stage: "Analizando música y ambiente",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const wavPath = path.join(ctx.workDir, "ambiance.wav");
    const outJson = path.join(ctx.workDir, "ambiance.json");

    try {
      const ambiance = await analyzeVideoAmbiance(ctx.videoPath, wavPath, outJson);
      if (ambiance.error) {
        return {
          id: "music_ambiance",
          title: "Música y ambiente",
          engine: ambiance.engine || "librosa",
          status: "error",
          summary: "Error",
          error: ambiance.error,
          items: [],
          data: ambiance,
        };
      }

      const items = (ambiance.items || []).map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.label,
        text: item.text,
      }));

      const profile = ambiance.profile;
      const summaryParts = [
        profile?.overall,
        profile?.rhythm,
        ambiance.tempo_bpm != null && (ambiance.tempo_confidence ?? 0) >= 0.35
          ? `~${ambiance.tempo_bpm} BPM`
          : null,
      ].filter(Boolean);

      return {
        id: "music_ambiance",
        title: "Música y ambiente",
        engine: ambiance.engine || "librosa",
        status: items.length > 0 ? "ok" : "empty",
        summary:
          items.length === 0
            ? profile?.overall || "Sin audio analizable"
            : summaryParts.join(" · ") || `${items.length} pasajes`,
        items,
        data: ambiance,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo analizar el ambiente de audio";
      return {
        id: "music_ambiance",
        title: "Música y ambiente",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
