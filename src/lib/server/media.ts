import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ProbeResult, VideoSpeech } from "@/lib/types";

const execFileAsync = promisify(execFile);

type ProbeJson = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    duration?: string;
  }>;
  format?: { duration?: string };
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

export async function probeVideo(filePath: string, filename: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { timeout: 20000 }
  );
  const probe = JSON.parse(stdout) as ProbeJson;
  const video = probe.streams?.find((s) => s.codec_type === "video");
  const soundtrack = probe.streams?.find((s) => s.codec_type === "audio");
  if (!video) {
    throw new Error("Este archivo no es un vídeo.");
  }
  const durationSec = Number(video.duration || probe.format?.duration || 0);
  const durationMs = Math.round(durationSec * 1000);

  let scenes = [{ startMs: 0, endMs: durationMs || 0 }];
  if (durationMs) {
    try {
      const { stderr } = await execFileAsync(
        "ffmpeg",
        ["-i", filePath, "-vf", "select='gt(scene,0.32)',showinfo", "-an", "-f", "null", "-"],
        { timeout: 45000, maxBuffer: 8 * 1024 * 1024 }
      ).catch((err: { stderr?: string }) => ({ stderr: String(err.stderr || "") }));
      scenes = parseScenes(String(stderr), durationMs);
    } catch {
      /* keep single scene */
    }
  }

  return {
    filename,
    durationMs,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: Math.round(parseFps(video.r_frame_rate) * 100) / 100,
    videoCodec: video.codec_name,
    soundtrackCodec: soundtrack?.codec_name,
    scenes,
  };
}

/** Transcribe speech that is already in the video. Intermediate WAV is not a product. */
export async function transcribeVideoSpeech(
  videoPath: string,
  wavPath: string,
  outJson: string
): Promise<VideoSpeech> {
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-c:a",
        "pcm_s16le",
        wavPath,
      ],
      { timeout: 60000 }
    );
  } catch {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath],
      { timeout: 60000 }
    );
  }

  const python = path.join(process.cwd(), ".venv", "bin", "python");
  const script = path.join(process.cwd(), "scripts", "from_video_speech.py");
  if (!existsSync(python)) {
    throw new Error(
      "Falta .venv. Ejecuta: python3 -m venv .venv && .venv/bin/pip install -r requirements-video.txt"
    );
  }
  const model = process.env.WHISPER_MODEL || "base";
  await execFileAsync(python, [script, wavPath, model, outJson], {
    timeout: 240000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      HF_HUB_DISABLE_TELEMETRY: "1",
    },
  });
  const raw = await readFile(outJson, "utf8");
  return JSON.parse(raw) as VideoSpeech;
}
