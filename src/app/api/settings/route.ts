import { NextResponse } from "next/server";
import { readAppConfig, writeAppConfig } from "@/lib/server/app-config";
import { deliverWebhook } from "@/lib/server/webhook";

export const runtime = "nodejs";

export async function GET() {
  const config = await readAppConfig();
  return NextResponse.json({
    webhookUrl: config.webhookUrl,
    webhookSecretSet: Boolean(config.webhookSecret),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    webhookUrl?: string;
    webhookSecret?: string;
  } | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const next = await writeAppConfig({
    webhookUrl: typeof body.webhookUrl === "string" ? body.webhookUrl : undefined,
    webhookSecret: typeof body.webhookSecret === "string" ? body.webhookSecret : undefined,
  });

  return NextResponse.json({
    webhookUrl: next.webhookUrl,
    webhookSecretSet: Boolean(next.webhookSecret),
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

  const delivery = await deliverWebhook({
    event: "job.ready",
    webhookUrl: url,
    job: {
      id: "job_test_webhook",
      name: "prueba-webhook.mp4",
      createdAt: new Date().toISOString(),
      status: "ready",
      progress: 100,
      stage: "Listo",
      activity: [],
      extraction: {
        source: { filename: "prueba-webhook.mp4", processed_at: new Date().toISOString() },
        media: {
          duration_ms: 1000,
          duration: "00:01.000",
          width: 640,
          height: 360,
          fps: 25,
          orientation: "horizontal",
        },
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
