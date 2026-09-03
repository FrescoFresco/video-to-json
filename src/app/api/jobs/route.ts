import { NextResponse } from "next/server";
import { clearJobs, createJobFromUpload, listJobs } from "@/lib/server/job-store";
import { isVideoFile } from "@/lib/video-file";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ jobs: listJobs() });
}

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

  const job = await createJobFromUpload(file);
  return NextResponse.json(job, { status: 202 });
}

export async function DELETE() {
  clearJobs();
  return NextResponse.json({ ok: true });
}
