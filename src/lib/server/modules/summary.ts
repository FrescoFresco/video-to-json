import { msToClock } from "@/lib/extraction";
import type { ExtractionModule } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

function ok(mod: ExtractionModule | undefined) {
  return mod?.status === "ok" ? mod : undefined;
}

function bullet(mod: ExtractionModule | undefined, max = 2): string[] {
  if (!mod?.items?.length) return [];
  return mod.items.slice(0, max).map((item) => {
    const when = typeof item.start_ms === "number" ? `${msToClock(item.start_ms)} · ` : "";
    const label = item.label ? `${item.label}: ` : "";
    return `- ${when}${label}${item.text}`.trim();
  });
}

/**
 * Resumen final a partir de módulos ya corridos (sin reanalizar el vídeo).
 */
export const summaryModule: ExtractionModuleDefinition = {
  id: "summary",
  title: "Resumen",
  stage: "Componiendo resumen",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const byId = new Map(ctx.previousModules.map((m) => [m.id, m]));
    const parts: string[] = [
      `Vídeo «${ctx.filename}» · ${msToClock(ctx.probe.durationMs)} · ${ctx.probe.width}×${ctx.probe.height}.`,
    ];

    const blocks: Array<[string, string]> = [
      ["scene_cuts", "Cortes"],
      ["camera_motion", "Cámara"],
      ["faces_framing", "Caras y encuadre"],
      ["speakers", "Quién habla"],
      ["speech", "Habla"],
      ["on_screen_text", "Texto en pantalla"],
      ["objects_people", "Objetos/personas"],
      ["pose_actions", "Pose y acciones"],
      ["visual_observation", "Observación visual"],
      ["music_ambiance", "Música y ambiente"],
      ["audio_events", "Eventos de audio"],
    ];

    const speakers = ok(byId.get("speakers"));
    for (const [id, title] of blocks) {
      if (id === "speech" && speakers) continue; // speakers ya cubre el habla
      const mod = ok(byId.get(id));
      if (!mod) continue;
      parts.push(`${title}: ${mod.summary}.`);
      parts.push(...bullet(mod));
    }

    const failed = ctx.previousModules.filter((m) => m.status === "error");
    if (failed.length) {
      parts.push(`Módulos con error: ${failed.map((m) => m.title).join(", ")}.`);
    }

    const text = parts.join("\n");
    const okCount = ctx.previousModules.filter((m) => m.status === "ok").length;

    return {
      id: "summary",
      title: "Resumen",
      engine: "compose",
      status: okCount > 0 ? "ok" : "empty",
      summary: okCount > 0 ? `Basado en ${okCount} módulos` : "Sin datos",
      items: text ? [{ label: "resumen", text }] : [],
      data: {
        text,
        based_on: ctx.previousModules.map((m) => ({
          id: m.id,
          status: m.status,
          summary: m.summary,
        })),
      },
    };
  },
};
