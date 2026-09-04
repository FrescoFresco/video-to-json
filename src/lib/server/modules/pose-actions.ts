import path from "node:path";
import type { ExtractionModule } from "@/lib/types";
import { extractDenseFrames, readPoseActions } from "../media";
import type { ExtractionModuleDefinition, ModuleContext } from "./types";

export const poseActionsModule: ExtractionModuleDefinition = {
  id: "pose_actions",
  title: "Pose y acciones",
  stage: "Estimando y describiendo pose",
  async run(ctx: ModuleContext): Promise<ExtractionModule> {
    const framesDir = path.join(ctx.workDir, "pose-frames");
    const manifestPath = path.join(ctx.workDir, "pose-frames.json");
    const outJson = path.join(ctx.workDir, "pose.json");

    try {
      const maxFrames = Number(process.env.POSE_MAX_FRAMES || 16);
      const frames = await extractDenseFrames(
        ctx.videoPath,
        ctx.probe.durationMs,
        framesDir,
        { maxFrames }
      );
      const limited = frames.slice(0, maxFrames);
      const pose = await readPoseActions(limited, manifestPath, outJson);

      const trackItems = (pose.items || []).filter((i) => i.role === "pose");
      const sourceItems = trackItems.length ? trackItems : pose.items || [];
      const items = sourceItems.map((item) => ({
        start_ms: item.start_ms,
        end_ms: item.end_ms,
        label: item.label || item.role || "pose",
        text: item.text,
      }));

      const counts = pose.profile?.posture_counts || {};
      const countBits = Object.entries(counts)
        .slice(0, 3)
        .map(([k, v]) => `${v}× ${k}`)
        .join(", ");
      const described = pose.vlm_described || 0;
      const summary =
        items.length === 0
          ? "Sin poses"
          : described > 0
            ? `${countBits || `${items.length} pistas`} · ${described} descritas`
            : countBits ||
              `${pose.profile?.person_detections || items.length} detecciones`;

      return {
        id: "pose_actions",
        title: "Pose y acciones",
        engine: pose.engine,
        status: items.length > 0 ? "ok" : "empty",
        summary,
        items,
        data: pose,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo estimar la pose";
      return {
        id: "pose_actions",
        title: "Pose y acciones",
        engine: null,
        status: "error",
        summary: "Error",
        error: message,
        items: [],
      };
    }
  },
};
