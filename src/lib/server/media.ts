import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { OnScreenText, ProbeResult, VideoSpeech } from "@/lib/types";

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
  } catch (first) {
    try {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath],
        { timeout: 60000 }
      );
    } catch (second) {
      const msg = `${first instanceof Error ? first.message : ""} ${second instanceof Error ? second.message : ""}`;
      if (/does not contain any stream/i.test(msg)) {
        return {
          engine: "faster-whisper",
          model: process.env.WHISPER_MODEL || "base",
          language: null,
          speakers: [],
          speaker_count: 0,
          diarization: "none",
          segments: [],
        };
      }
      throw second;
    }
  }

  const python = resolvePythonBin();
  const script = path.join(process.cwd(), "scripts", "from_video_speech.py");
  if (!existsSync(/*turbopackIgnore: true*/ python)) {
    throw new Error(
      "Falta el entorno Python del pipeline. Ejecuta ./install.sh en la raiz del proyecto."
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

function resolvePythonBin() {
  if (process.env.VIDEO_PYTHON && existsSync(/*turbopackIgnore: true*/ process.env.VIDEO_PYTHON)) {
    return process.env.VIDEO_PYTHON;
  }
  // Buscar venvs conocidos sin hardcodear un único path (Turbopack no debe seguir symlinks).
  const candidates = [process.env.VIDEO_VENV_DIR, "video-py", ".venv"].filter(Boolean) as string[];
  for (const dir of candidates) {
    const bin = path.join(/*turbopackIgnore: true*/ process.cwd(), dir, "bin", "python");
    if (existsSync(/*turbopackIgnore: true*/ bin)) return bin;
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "video-py", "bin", "python");
}

function pythonBin() {
  return resolvePythonBin();
}

function framePlan(scenes: { startMs: number; endMs: number }[], durationMs: number) {
  const maxFrames = 12;
  if (scenes.length >= 2) {
    return scenes.slice(0, maxFrames);
  }
  const step = Math.max(800, Math.round(durationMs / maxFrames) || 800);
  const out: { startMs: number; endMs: number }[] = [];
  for (let t = 0; t < Math.max(durationMs, 1) && out.length < maxFrames; t += step) {
    out.push({ startMs: t, endMs: Math.min(durationMs, t + step) });
  }
  return out.length ? out : [{ startMs: 0, endMs: durationMs }];
}

export async function extractSceneFrames(
  videoPath: string,
  scenes: { startMs: number; endMs: number }[],
  durationMs: number,
  outDir: string
) {
  await mkdir(outDir, { recursive: true });
  const plan = framePlan(scenes, durationMs);
  const frames: { path: string; start_ms: number; end_ms: number }[] = [];
  for (const [i, scene] of plan.entries()) {
    const mid = (scene.startMs + scene.endMs) / 2 / 1000;
    const file = path.join(outDir, `f${String(i).padStart(3, "0")}.jpg`);
    await execFileAsync(
      "ffmpeg",
      ["-y", "-ss", String(Math.max(0, mid)), "-i", videoPath, "-frames:v", "1", "-q:v", "3", file],
      { timeout: 15000 }
    );
    if (existsSync(file)) {
      frames.push({ path: file, start_ms: scene.startMs, end_ms: scene.endMs });
    }
  }
  return frames;
}

export async function readOnScreenText(
  frames: { path: string; start_ms: number; end_ms: number }[],
  manifestPath: string,
  outJson: string
): Promise<OnScreenText> {
  const python = pythonBin();
  const script = path.join(process.cwd(), "scripts", "from_video_ocr.py");
  if (!existsSync(/*turbopackIgnore: true*/ python)) {
    throw new Error(
      "Falta el entorno Python del pipeline. Ejecuta ./install.sh en la raiz del proyecto."
    );
  }
  await writeFile(manifestPath, JSON.stringify({ frames }), "utf8");
  await execFileAsync(python, [script, manifestPath, outJson], {
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(await readFile(outJson, "utf8")) as OnScreenText;
}
