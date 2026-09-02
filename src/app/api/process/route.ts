import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";
import { extractAudioJson, probeMedia } from "@/lib/server/media";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size > 80 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 80 MB en este entorno" }, { status: 413 });
  }

  const dir = path.join(os.tmpdir(), "vx-process");
  await mkdir(dir, { recursive: true });
  const stamp = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const mediaPath = path.join(dir, stamp);
  const wavPath = path.join(dir, `${stamp}.wav`);
  const jsonPath = path.join(dir, `${stamp}.json`);

  try {
    await writeFile(mediaPath, Buffer.from(await file.arrayBuffer()));
    const probe = await probeMedia(mediaPath, file.name);

    let audio = null;
    let audioError: string | null = null;
    try {
      audio = await extractAudioJson(mediaPath, wavPath, jsonPath);
    } catch (error) {
      audioError = error instanceof Error ? error.message : "Falló el audio";
    }

    return NextResponse.json({ probe, audio, audioError });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar" },
      { status: 500 }
    );
  } finally {
    await unlink(mediaPath).catch(() => undefined);
    await unlink(wavPath).catch(() => undefined);
    await unlink(jsonPath).catch(() => undefined);
  }
}
