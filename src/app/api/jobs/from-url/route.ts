import { NextResponse } from "next/server";
import { createJobFromUrl } from "@/lib/server/job-store";
import { parseAllowedVideoUrl } from "@/lib/server/url-download";

export const runtime = "nodejs";
export const maxDuration = 300;

function collectUrls(body: { url?: unknown; urls?: unknown }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  if (Array.isArray(body.urls)) {
    for (const item of body.urls) push(item);
  } else if (typeof body.urls === "string") {
    for (const line of body.urls.split(/[\n,]+/)) push(line);
  }

  push(body.url);

  return out;
}

export async function POST(request: Request) {
  let body: { url?: unknown; urls?: unknown; webhook_url?: unknown };
  try {
    body = (await request.json()) as {
      url?: unknown;
      urls?: unknown;
      webhook_url?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const urls = collectUrls(body);
  if (!urls.length) {
    return NextResponse.json(
      { error: "Falta el link. Envía url o urls (lista)." },
      { status: 400 }
    );
  }

  const webhookUrl =
    typeof body.webhook_url === "string" ? body.webhook_url : null;

  const rejected: Array<{ url: string; error: string }> = [];
  const accepted: string[] = [];

  for (const url of urls) {
    try {
      parseAllowedVideoUrl(url);
      accepted.push(url);
    } catch (error) {
      rejected.push({
        url,
        error: error instanceof Error ? error.message : "Link no válido",
      });
    }
  }

  if (!accepted.length) {
    return NextResponse.json(
      { error: "Ningún link válido", rejected },
      { status: 400 }
    );
  }

  const jobs = [];
  for (const url of accepted) {
    jobs.push(await createJobFromUrl(url, { webhookUrl }));
  }

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
