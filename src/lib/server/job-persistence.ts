import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureCompleteExtraction } from "@/lib/extraction";
import type { StoredVideo, VideoJobResult } from "@/lib/types";

export type JobRecord = StoredVideo & {
  result?: VideoJobResult;
};

function dataRoot() {
  if (process.env.VX_DATA_DIR) return process.env.VX_DATA_DIR;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "jobs");
}

function jobDir(id: string) {
  return path.join(/*turbopackIgnore: true*/ dataRoot(), id);
}

export async function ensureDataRoot() {
  await mkdir(/*turbopackIgnore: true*/ dataRoot(), { recursive: true });
}

function upgradeJobRecord(meta: StoredVideo, result?: VideoJobResult): JobRecord {
  const extraction = ensureCompleteExtraction(meta.extraction) ?? meta.extraction;
  const upgradedResult = result
    ? {
        ...result,
        extraction: ensureCompleteExtraction(result.extraction) ?? result.extraction,
      }
    : undefined;
  return {
    ...meta,
    extraction,
    result: upgradedResult,
  };
}

export async function loadAllJobsFromDisk(): Promise<Map<string, JobRecord>> {
  const map = new Map<string, JobRecord>();
  try {
    await ensureDataRoot();
    const entries = await readdir(/*turbopackIgnore: true*/ dataRoot(), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      try {
        const metaRaw = await readFile(
          /*turbopackIgnore: true*/ path.join(jobDir(id), "job.json"),
          "utf8"
        );
        const meta = JSON.parse(metaRaw) as StoredVideo;
        let result: VideoJobResult | undefined;
        try {
          const resultRaw = await readFile(
            /*turbopackIgnore: true*/ path.join(jobDir(id), "result.json"),
            "utf8"
          );
          result = JSON.parse(resultRaw) as VideoJobResult;
        } catch {
          result = undefined;
        }
        map.set(id, upgradeJobRecord(meta, result));
      } catch {
        // carpeta incompleta: se ignora
      }
    }
  } catch {
    // sin carpeta aún
  }
  return map;
}

export async function persistJob(job: JobRecord) {
  await ensureDataRoot();
  const dir = jobDir(job.id);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const { result, ...meta } = job;
  await writeFile(
    /*turbopackIgnore: true*/ path.join(dir, "job.json"),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
  if (result) {
    await writeFile(
      /*turbopackIgnore: true*/ path.join(dir, "result.json"),
      JSON.stringify(result, null, 2),
      "utf8"
    );
  }
}

export async function clearJobsFromDisk() {
  await rm(/*turbopackIgnore: true*/ dataRoot(), { recursive: true, force: true });
  await ensureDataRoot();
}
