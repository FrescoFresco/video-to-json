import { unlink, rm } from "node:fs/promises";
import path from "node:path";
import type { VideoJobResult } from "@/lib/types";
import { buildVideoExtraction } from "@/lib/demo-extraction";
import { extractSceneFrames, probeVideo, readOnScreenText, transcribeVideoSpeech } from "./media";

export async function processVideoFile(
  videoPath: string,
  filename: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<VideoJobResult> {
  const wavPath = `${videoPath}.wav`;
  const speechJsonPath = `${videoPath}.speech.json`;
  const ocrJsonPath = `${videoPath}.ocr.json`;
  const manifestPath = `${videoPath}.frames.json`;
  const framesDir = path.join(path.dirname(videoPath), `${path.basename(videoPath)}-frames`);

  try {
    onProgress?.(22, "Leyendo metadatos");
    const probe = await probeVideo(videoPath, filename);

    onProgress?.(52, "Transcribiendo habla");
    let speech = null;
    let speechError: string | null = null;
    try {
      speech = await transcribeVideoSpeech(videoPath, wavPath, speechJsonPath);
    } catch (error) {
      speechError = error instanceof Error ? error.message : "No se pudo leer el habla del vídeo";
    }

    onProgress?.(78, "Leyendo texto en pantalla");
    let onScreenText = null;
    let ocrError: string | null = null;
    try {
      const frames = await extractSceneFrames(videoPath, probe.scenes, probe.durationMs, framesDir);
      onScreenText = await readOnScreenText(frames, manifestPath, ocrJsonPath);
    } catch (error) {
      ocrError = error instanceof Error ? error.message : "No se pudo leer el texto en pantalla";
    }

    onProgress?.(92, "Componiendo JSON");
    const extraction = buildVideoExtraction({
      filename,
      processedAt: new Date().toISOString(),
      probe,
      speech,
      onScreenText,
    });

    return {
      probe,
      speech,
      speechError,
      onScreenText,
      ocrError,
      extraction,
    };
  } finally {
    await unlink(wavPath).catch(() => undefined);
    await unlink(speechJsonPath).catch(() => undefined);
    await unlink(ocrJsonPath).catch(() => undefined);
    await unlink(manifestPath).catch(() => undefined);
    await rm(framesDir, { recursive: true, force: true }).catch(() => undefined);
    await unlink(videoPath).catch(() => undefined);
  }
}
