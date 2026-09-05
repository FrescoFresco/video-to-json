import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_URL_CHARS = 2048;
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Dominios de vídeo públicos que permitimos (anti-SSRF + foco en redes). */
const ALLOWED_HOST_SUFFIXES = [
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "fb.gg",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "vimeo.com",
  "reddit.com",
  "redd.it",
  "twitch.tv",
  "streamable.com",
];

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".mov", ".m4v"]);

export type DownloadedVideo = {
  filePath: string;
  filename: string;
  sourceUrl: string;
  extractor?: string;
  workDir: string;
};

function resolveYtDlpBin(): string {
  const fromEnv = process.env.YT_DLP_BIN;
  if (fromEnv && existsSync(/*turbopackIgnore: true*/ fromEnv)) return fromEnv;

  const candidates = [
    path.join(process.cwd(), "video-py", "bin", "yt-dlp"),
    path.join(process.cwd(), ".venv", "bin", "yt-dlp"),
  ];
  for (const bin of candidates) {
    if (existsSync(/*turbopackIgnore: true*/ bin)) return bin;
  }
  return "yt-dlp";
}

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost") return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // IPs no
  if (host.includes(":")) return false; // IPv6 no
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

export function parseAllowedVideoUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_CHARS) {
    throw new Error("El link no es válido");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("El link no es válido");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Solo se admiten links http(s)");
  }
  if (!hostAllowed(url.hostname)) {
    throw new Error(
      "Solo TikTok, Instagram, Facebook, YouTube, X/Twitter, Vimeo y similares"
    );
  }
  return url;
}

async function findDownloadedVideo(dir: string): Promise<string | null> {
  const entries = await readdir(dir);
  const candidates: Array<{ full: string; size: number }> = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    const info = await stat(full);
    if (!info.isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) continue;
    candidates.push({ full, size: info.size });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.size - a.size);
  return candidates[0].full;
}

/**
 * Descarga un vídeo público con yt-dlp a un directorio temporal.
 * El llamador debe borrar `workDir` cuando ya no lo necesite.
 */
export async function downloadVideoFromUrl(rawUrl: string): Promise<DownloadedVideo> {
  const url = parseAllowedVideoUrl(rawUrl);
  const workDir = path.join(os.tmpdir(), "vx-url", `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(workDir, { recursive: true });

  const outTemplate = path.join(workDir, "%(id)s.%(ext)s");
  const bin = resolveYtDlpBin();
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--no-mtime",
    "--restrict-filenames",
    "--merge-output-format",
    "mp4",
    "-f",
    "b/bv*+ba/b",
    "--max-filesize",
    String(MAX_DOWNLOAD_BYTES),
    "--socket-timeout",
    "30",
    "-o",
    outTemplate,
    "--print",
    "after_move:filepath",
    "--print",
    "%(extractor)s",
    "--print",
    "%(title)s",
  ];

  // Impersonate ayuda con TikTok/Instagram; si el binario no lo soporta, reintentamos sin él.
  const attempts: string[][] = [
    [...args, "--impersonate", "chrome", url.href],
    [...args, url.href],
  ];

  let lastError = "No se pudo descargar el vídeo";
  let extractor: string | undefined;
  let titleHint: string | undefined;

  for (const attempt of attempts) {
    try {
      const { stdout, stderr } = await execFileAsync(bin, attempt, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });
      const lines = `${stdout || ""}\n${stderr || ""}`
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // yt-dlp --print emite líneas; buscamos el archivo en disco por si el print falla.
      let filePath = await findDownloadedVideo(workDir);
      if (!filePath) {
        for (const line of lines) {
          if (VIDEO_EXTS.has(path.extname(line).toLowerCase()) && existsSync(line)) {
            filePath = line;
            break;
          }
        }
      }
      if (!filePath) {
        lastError = "La descarga no produjo un archivo de vídeo";
        continue;
      }

      const info = await stat(filePath);
      if (info.size <= 0) {
        lastError = "El archivo descargado está vacío";
        continue;
      }
      if (info.size > MAX_DOWNLOAD_BYTES) {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
        throw new Error("El vídeo supera el máximo de 80 MB");
      }

      // Heurística: extractor y título suelen salir en las prints.
      const printLines = (stdout || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (printLines.length >= 2) {
        extractor = printLines[1];
        titleHint = printLines[2] || printLines[1];
      }

      const base = path.basename(filePath);
      const safeTitle = (titleHint || base)
        .replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]+/gi, "_")
        .trim()
        .slice(0, 80);
      const ext = path.extname(base) || ".mp4";
      const filename = safeTitle.toLowerCase().endsWith(ext.toLowerCase())
        ? safeTitle
        : `${safeTitle}${ext}`;

      return {
        filePath,
        filename,
        sourceUrl: url.href,
        extractor,
        workDir,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo descargar el vídeo";
      lastError = message
        .replace(/^Command failed:.*\n?/i, "")
        .replace(/ERROR:\s*/gi, "")
        .trim()
        .slice(0, 280) || lastError;

      if (/blocked|403|login|sign in|private/i.test(lastError)) {
        break;
      }
    }
  }

  await rm(workDir, { recursive: true, force: true }).catch(() => undefined);

  if (/blocked from accessing/i.test(lastError)) {
    throw new Error(
      "Esta red bloquea la descarga (TikTok/Instagram a veces lo hacen en servidores). Prueba en tu PC."
    );
  }
  if (/login|sign in|cookies/i.test(lastError)) {
    throw new Error(
      "Ese vídeo pide inicio de sesión o es privado. Usa un link público."
    );
  }
  throw new Error(lastError || "No se pudo descargar el vídeo desde ese link");
}

export async function cleanupDownloadDir(workDir: string | undefined) {
  if (!workDir) return;
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
}
