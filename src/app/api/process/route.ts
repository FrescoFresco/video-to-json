import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";
import { probeVideo, transcribeVideoSpeech } from "@/lib/server/media";
import { isVideoFile } from "@/lib/video-file";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el vídeo" }, { status: 400 });
  }
  if (!isVideoFile(file)) {
    return NextResponse.json({ error: "Solo se aceptan vídeos." }, { status: 415 });
  }
  if (file.size > 80 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 80 MB en este entorno" }, { status: 413 });
  }

  const dir = path.join(os.tmpdir(), "vx-process");
  await mkdir(dir, { recursive: true });
  const stamp = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const videoPath = path.join(dir, stamp);
  const wavPath = path.join(dir, `${stamp}.wav`);
  const jsonPath = path.join(dir, `${stamp}.json`);

  try {
    await writeFile(videoPath, Buffer.from(await file.arrayBuffer()));
    const probe = await probeVideo(videoPath, file.name);

    let speech = null;
    let speechError: string | null = null;
    try {
      speech = await transcribeVideoSpeech(videoPath, wavPath, jsonPath);
    } catch (error) {
      speechError = error instanceof Error ? error.message : "No se pudo leer el habla del vídeo";
    }

    return NextResponse.json({ probe, speech, speechError });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el vídeo" },
      { status: 500 }
    );
  } finally {
    await unlink(videoPath).catch(() => undefined);
    await unlink(wavPath).catch(() => undefined);
    await unlink(jsonPath).catch(() => undefined);
  }
}
