import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";
import { probeMedia } from "@/lib/server/media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size > 80 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 80 MB" }, { status: 413 });
  }
  const dir = path.join(os.tmpdir(), "vx-probe");
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`);
  try {
    await writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(await probeMedia(tmp, file.name));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el vídeo" },
      { status: 500 }
    );
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
}
