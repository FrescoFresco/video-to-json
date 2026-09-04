import { msToClock } from "@/lib/extraction";
import type { ExtractionModule } from "@/lib/types";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

function takeLines(mod: ExtractionModule | undefined, max = 3): string[] {
  if (!mod || !mod.items?.length) return [];
  return mod.items.slice(0, max).map((item) => {
    const when =
      typeof item.start_ms === "number" ? `${msToClock(item.start_ms)} · ` : "";
    const label = item.label ? `${item.label}: ` : "";
    return `${when}${label}${item.text}`.trim();
  });
}

/**
 * Resumen final a partir de los módulos ya corridos (sin inventar datos nuevos).
 */
export const summaryModule: ExtractionModuleDefinition = {
  id: "summary",
  title: "Resumen",
  stage: "Componiendo resumen",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const byId = new Map(ctx.previousModules.map((m) => [m.id, m]));
    const parts: string[] = [];

    parts.push(
      `Vídeo «${ctx.filename}» · ${msToClock(ctx.probe.durationMs)} · ${ctx.probe.width}×${ctx.probe.height}.`
    );

    const scenes = byId.get("scene_cuts");
    if (scenes?.status === "ok") parts.push(`Cortes: ${scenes.summary}.`);

    const camera = byId.get("camera_motion");
    if (camera?.status === "ok") {
      parts.push(`Cámara: ${camera.summary}.`);
      for (const line of takeLines(camera, 2)) parts.push(`- ${line}`);
    }

    const speakers = byId.get("speakers");
    if (speakers?.status === "ok") {
      parts.push(`Quién habla: ${speakers.summary}.`);
      for (const line of takeLines(speakers, 3)) parts.push(`- ${line}`);
    } else if (byId.get("speech")?.status === "ok") {
      parts.push(`Habla: ${byId.get("speech")!.summary}.`);
    }

    const ocr = byId.get("on_screen_text");
    if (ocr?.status === "ok" && ocr.items.length) {
      parts.push(`Texto en pantalla: ${ocr.summary}.`);
      for (const line of takeLines(ocr, 2)) parts.push(`- ${line}`);
    }

    const objects = byId.get("objects_people");
    if (objects?.status === "ok") {
      parts.push(`Objetos/personas: ${objects.summary}.`);
      for (const line of takeLines(objects, 3)) parts.push(`- ${line}`);
    }

    const faces = byId.get("faces_framing");
    if (faces?.status === "ok") {
      parts.push(`Caras y encuadre: ${faces.summary}.`);
      for (const line of takeLines(faces, 2)) parts.push(`- ${line}`);
    }

    const pose = byId.get("pose_actions");
    if (pose?.status === "ok") {
      parts.push(`Pose y acciones: ${pose.summary}.`);
      for (const line of takeLines(pose, 2)) parts.push(`- ${line}`);
    }

    const visual = byId.get("visual_observation");
    if (visual?.status === "ok" && visual.items.length) {
      parts.push(`Observación visual: ${visual.summary}.`);
      for (const line of takeLines(visual, 2)) parts.push(`- ${line}`);
    }

    const reasoning = byId.get("ai_reasoning");
    if (reasoning?.status === "ok" && reasoning.items.length) {
      parts.push(`Razonamiento IA: ${reasoning.summary}.`);
      for (const line of takeLines(reasoning, 3)) parts.push(`- ${line}`);
    }

    const ambiance = byId.get("music_ambiance");
    if (ambiance?.status === "ok") {
      parts.push(`Música y ambiente: ${ambiance.summary}.`);
      for (const line of takeLines(ambiance, 2)) parts.push(`- ${line}`);
    }

    const audioEvents = byId.get("audio_events");
    if (audioEvents?.status === "ok") {
      parts.push(`Eventos de audio: ${audioEvents.summary}.`);
      for (const line of takeLines(audioEvents, 2)) parts.push(`- ${line}`);
    }

    const failed = ctx.previousModules.filter((m) => m.status === "error");
    if (failed.length) {
      parts.push(
        `Módulos con error: ${failed.map((m) => m.title).join(", ")}.`
      );
    }

    const text = parts.join("\n");
    const okModules = ctx.previousModules.filter((m) => m.status === "ok").length;

    return {
      id: "summary",
      title: "Resumen",
      engine: "compose",
      status: okModules > 0 ? "ok" : "empty",
      summary: okModules > 0 ? `Basado en ${okModules} módulos` : "Sin datos",
      items: text
        ? [
            {
              label: "resumen",
              text,
            },
          ]
        : [],
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
