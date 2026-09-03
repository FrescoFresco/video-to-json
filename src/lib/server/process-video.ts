import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildVideoExtraction } from "@/lib/extraction";
import type { ExtractionModule, VideoJobResult } from "@/lib/types";
import { probeVideo } from "./media";
import { EXTRACTION_MODULES } from "./modules";

export async function processVideoFile(
  videoPath: string,
  filename: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<VideoJobResult> {
  const workDir = path.join(path.dirname(videoPath), `${path.basename(videoPath)}-work`);

  try {
    await mkdir(workDir, { recursive: true });
    onProgress?.(12, "Leyendo metadatos");
    const probe = await probeVideo(videoPath, filename);

    const modules: ExtractionModule[] = [];
    const total = EXTRACTION_MODULES.length || 1;

    for (const [index, definition] of EXTRACTION_MODULES.entries()) {
      const start = 20;
      const span = 70;
      const progress = Math.round(start + (span * index) / total);
      onProgress?.(progress, definition.stage);

      const result = await definition.run({
        videoPath,
        filename,
        probe,
        workDir,
        previousModules: [...modules],
      });
      modules.push(result);
    }

    onProgress?.(95, "Componiendo JSON");
    const extraction = buildVideoExtraction({
      filename,
      processedAt: new Date().toISOString(),
      probe,
      modules,
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
