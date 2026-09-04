import { NextResponse } from "next/server";
import { createJobFromUrl } from "@/lib/server/job-store";
import { parseAllowedVideoUrl } from "@/lib/server/url-download";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: { url?: unknown; webhook_url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; webhook_url?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Falta el link (url)" }, { status: 400 });
  }

  try {
    parseAllowedVideoUrl(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Link no válido";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const webhookUrl =
    typeof body.webhook_url === "string" ? body.webhook_url : null;

  const job = await createJobFromUrl(url, { webhookUrl });
  return NextResponse.json(job, { status: 202 });
}
