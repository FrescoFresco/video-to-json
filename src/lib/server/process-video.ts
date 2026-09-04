import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildVideoExtraction } from "@/lib/extraction";
import type { ExtractionModule, ProbeResult, VideoJobResult } from "@/lib/types";
import { probeVideo } from "./media";
import { EXTRACTION_MODULES } from "./modules";

export type ProcessVideoCallbacks = {
  onProgress?: (progress: number, stage: string) => void;
  /** Se llama tras cada módulo (la UI puede pintar el JSON parcial). */
  onModule?: (info: {
    module: ExtractionModule;
    modules: ExtractionModule[];
    probe: ProbeResult;
  }) => void;
  onProbe?: (probe: ProbeResult) => void;
  /** Origen del vídeo (link, subida, carpeta). */
  source?: {
    url?: string | null;
    kind?: "upload" | "url" | "folder";
  };
};

export async function processVideoFile(
  videoPath: string,
  filename: string,
  callbacks?: ProcessVideoCallbacks | ((progress: number, stage: string) => void)
): Promise<VideoJobResult> {
  const cb: ProcessVideoCallbacks =
    typeof callbacks === "function" ? { onProgress: callbacks } : callbacks || {};

  const workDir = path.join(path.dirname(videoPath), `${path.basename(videoPath)}-work`);

  try {
    await mkdir(workDir, { recursive: true });
    cb.onProgress?.(12, "Leyendo metadatos");
    const probe = await probeVideo(videoPath, filename);
    cb.onProbe?.(probe);

    const modules: ExtractionModule[] = [];
    const total = EXTRACTION_MODULES.length || 1;

    for (const [index, definition] of EXTRACTION_MODULES.entries()) {
      const start = 20;
      const span = 70;
      const progress = Math.round(start + (span * index) / total);
      cb.onProgress?.(progress, definition.stage);

      const t0 = Date.now();
      const result = await definition.run({
        videoPath,
        filename,
        probe,
        workDir,
        previousModules: [...modules],
      });
      const timed: ExtractionModule = {
        ...result,
        duration_ms: Math.max(1, Date.now() - t0),
      };
      modules.push(timed);
      cb.onModule?.({ module: timed, modules: [...modules], probe });
    }

    cb.onProgress?.(95, "Componiendo JSON");
    const extraction = buildVideoExtraction({
      filename,
      processedAt: new Date().toISOString(),
      probe,
      modules,
      sourceUrl: cb.source?.url,
      sourceKind: cb.source?.kind,
    });

    return {
      probe,
      modules,
      extraction,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    await rm(videoPath, { force: true }).catch(() => undefined);
  }
}
