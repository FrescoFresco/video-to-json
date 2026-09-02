import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

type ProbeJson = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    duration?: string;
  }>;
  format?: { duration?: string; filename?: string };
};

function parseFps(rate?: string) {
  if (!rate || rate === "0/0") return 0;
  const [a, b] = rate.split("/").map(Number);
  if (!b) return a || 0;
  return a / b;
}

function parseScenes(stderr: string, durationMs: number) {
  const times = [...stderr.matchAll(/pts_time:\s*([0-9.]+)/g)].map((m) =>
    Math.round(Number(m[1]) * 1000)
  );
  const unique = [...new Set(times)].sort((a, b) => a - b);
  const cuts = [0, ...unique.filter((t) => t > 120 && t < durationMs - 120), durationMs];
  const scenes: { startMs: number; endMs: number }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    if (cuts[i + 1] - cuts[i] < 80) continue;
    scenes.push({ startMs: cuts[i], endMs: cuts[i + 1] });
  }
  return scenes.length ? scenes : [{ startMs: 0, endMs: durationMs }];
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size > 80 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 80 MB en este entorno" }, { status: 413 });
  }

  const tmp = await mkdir(path.join(os.tmpdir(), "vx-probe"), { recursive: true }).then(
    () => path.join(os.tmpdir(), "vx-probe", `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`)
  );

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(tmp, buf);

    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", tmp],
      { timeout: 20000 }
    );
    const probe = JSON.parse(stdout) as ProbeJson;
    const video = probe.streams?.find((s) => s.codec_type === "video");
    const audio = probe.streams?.find((s) => s.codec_type === "audio");
    const durationSec = Number(video?.duration || probe.format?.duration || 0);
    const durationMs = Math.round(durationSec * 1000);

    let scenes = [{ startMs: 0, endMs: durationMs || 0 }];
    try {
      const { stderr } = await execFileAsync(
        "ffmpeg",
        [
          "-i",
          tmp,
          "-vf",
          "select='gt(scene,0.32)',showinfo",
          "-an",
          "-f",
          "null",
          "-",
        ],
        { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }
      ).catch((err: { stderr?: string }) => ({ stderr: String(err.stderr || "") }));
      if (durationMs) scenes = parseScenes(String(stderr), durationMs);
    } catch {
      /* keep single scene */
    }

    return NextResponse.json({
      filename: file.name,
      durationMs,
      width: video?.width ?? 0,
      height: video?.height ?? 0,
      fps: Math.round(parseFps(video?.r_frame_rate) * 100) / 100,
      videoCodec: video?.codec_name,
      audioCodec: audio?.codec_name,
      scenes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el vídeo" },
      { status: 500 }
    );
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
}
