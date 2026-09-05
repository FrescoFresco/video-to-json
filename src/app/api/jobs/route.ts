import { NextResponse } from "next/server";
import { clearJobs, createJobFromUpload, listJobs } from "@/lib/server/job-store";
import { isVideoFile } from "@/lib/video-file";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 80 * 1024 * 1024;

function collectVideoFiles(form: FormData): File[] {
  const out: File[] = [];
  const seen = new Set<File>();

  for (const key of ["file", "files", "videos"]) {
    for (const value of form.getAll(key)) {
      if (value instanceof File && !seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
  }

  // Cualquier otro campo File por si el cliente manda file[0], etc.
  for (const [, value] of form.entries()) {
    if (value instanceof File && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }

  return out;
}

export async function GET() {
  return NextResponse.json({ jobs: await listJobs() });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const files = collectVideoFiles(form);
  const webhookUrl =
    typeof form.get("webhook_url") === "string" ? String(form.get("webhook_url")) : null;

  if (!files.length) {
    return NextResponse.json(
      { error: "Falta el vídeo. Envía file / files (uno o varios)." },
      { status: 400 }
    );
  }

  const rejected: Array<{ name: string; error: string }> = [];
  const accepted: File[] = [];

  for (const file of files) {
    if (!isVideoFile(file)) {
      rejected.push({ name: file.name, error: "Solo se aceptan vídeos" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      rejected.push({ name: file.name, error: "Máximo 80 MB por archivo" });
      continue;
    }
    accepted.push(file);
  }

  if (!accepted.length) {
    return NextResponse.json(
      { error: "Ningún vídeo válido", rejected },
      { status: 415 }
    );
  }

  const jobs = [];
  for (const file of accepted) {
    jobs.push(await createJobFromUpload(file, { webhookUrl }));
  }

  // Un solo archivo: respuesta compacta (compatible). Varios: lista.
  if (jobs.length === 1 && rejected.length === 0) {
    return NextResponse.json(jobs[0], { status: 202 });
  }

  return NextResponse.json(
    {
      jobs,
      rejected,
      count: jobs.length,
    },
    { status: 202 }
  );
}

export async function DELETE() {
  await clearJobs();
  return NextResponse.json({ ok: true });
}
