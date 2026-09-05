import { NextResponse } from "next/server";
import { EXTRACTION_SCHEMA_VERSION } from "@/lib/extraction";
import { readAppConfig, writeAppConfig } from "@/lib/server/app-config";
import { deliverWebhook } from "@/lib/server/webhook";

export const runtime = "nodejs";

export async function GET() {
  const config = await readAppConfig();
  return NextResponse.json({
    webhookUrl: config.webhookUrl,
    webhookSecretSet: Boolean(config.webhookSecret),
    inboxPath: config.inboxPath,
    outboxPath: config.outboxPath,
    inboxEnabled: config.inboxEnabled,
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    webhookUrl?: string;
    webhookSecret?: string;
    clearWebhookSecret?: boolean;
    inboxPath?: string;
    outboxPath?: string;
    inboxEnabled?: boolean;
  } | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const next = await writeAppConfig({
    webhookUrl: typeof body.webhookUrl === "string" ? body.webhookUrl : undefined,
    webhookSecret:
      body.clearWebhookSecret === true
        ? ""
        : typeof body.webhookSecret === "string"
          ? body.webhookSecret
          : undefined,
    inboxPath: typeof body.inboxPath === "string" ? body.inboxPath : undefined,
    outboxPath: typeof body.outboxPath === "string" ? body.outboxPath : undefined,
    inboxEnabled: typeof body.inboxEnabled === "boolean" ? body.inboxEnabled : undefined,
  });

  return NextResponse.json({
    webhookUrl: next.webhookUrl,
    webhookSecretSet: Boolean(next.webhookSecret),
    inboxPath: next.inboxPath,
    outboxPath: next.outboxPath,
    inboxEnabled: next.inboxEnabled,
  });
}

/** Envía un evento de prueba al webhook configurado. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { webhookUrl?: string };
  const config = await readAppConfig();
  const url = (body.webhookUrl || config.webhookUrl || "").trim();
  if (!url) {
    return NextResponse.json({ error: "Configura una URL de webhook primero" }, { status: 400 });
  }

  const processedAt = new Date().toISOString();
  const delivery = await deliverWebhook({
    event: "job.ready",
    webhookUrl: url,
    job: {
      id: "job_test_webhook",
      name: "prueba-webhook.mp4",
      createdAt: processedAt,
      status: "ready",
      progress: 100,
      stage: "Listo",
      activity: [],
      extraction: {
        schema_version: EXTRACTION_SCHEMA_VERSION,
        kind: "video_complete",
        source: {
          filename: "prueba-webhook.mp4",
          processed_at: processedAt,
          input: "url",
          url: "https://www.tiktok.com/@demo/video/123",
        },
        media: {
          duration_ms: 1000,
          duration: "00:01.000",
          width: 640,
          height: 360,
          fps: 25,
          orientation: "horizontal",
        },
        run: {
          module_count: 1,
          ok: 1,
          empty: 0,
          error: 0,
          total_module_ms: 12,
          modules: [
            {
              id: "summary",
              title: "Resumen",
              status: "ok",
              summary: "Prueba de webhook",
              item_count: 1,
            },
          ],
        },
        content: {
          summary: {
            id: "summary",
            title: "Resumen",
            status: "ok",
            summary: "Prueba de webhook",
            items: [{ label: "resumen", text: "Esto es un evento de prueba." }],
            data: { text: "Esto es un evento de prueba." },
          },
        },
        timeline: [
          {
            module_id: "summary",
            module_title: "Resumen",
            label: "resumen",
            text: "Esto es un evento de prueba.",
          },
        ],
        modules: [
          {
            id: "summary",
            title: "Resumen",
            status: "ok",
            summary: "Prueba de webhook",
            items: [{ label: "resumen", text: "Esto es un evento de prueba." }],
          },
        ],
      },
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "No hay URL de webhook" }, { status: 400 });
  }
  if (!delivery.ok) {
    return NextResponse.json(
      { ok: false, error: delivery.error, status: delivery.status, url: delivery.url },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, status: delivery.status, url: delivery.url });
}
