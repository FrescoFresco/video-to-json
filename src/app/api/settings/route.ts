import { NextResponse } from "next/server";
import { EXTRACTION_SCHEMA_VERSION } from "@/lib/extraction";
import type { StoredVideo } from "@/lib/types";
import {
  publicAppConfig,
  readAppConfig,
  writeAppConfig,
} from "@/lib/server/app-config";
import { deleteDriveFile, uploadJsonToDrive } from "@/lib/server/google-drive";
import { deliverWebhook } from "@/lib/server/webhook";

export const runtime = "nodejs";

export async function GET() {
  const config = await readAppConfig();
  return NextResponse.json(publicAppConfig(config));
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    webhookUrl?: string;
    webhookSecret?: string;
    clearWebhookSecret?: boolean;
    inboxPath?: string;
    outboxPath?: string;
    inboxEnabled?: boolean;
    driveEnabled?: boolean;
    driveFolderId?: string;
    driveServiceAccountJson?: string;
    clearDriveCredentials?: boolean;
  } | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (
    typeof body.driveServiceAccountJson === "string" &&
    body.driveServiceAccountJson.trim()
  ) {
    try {
      const parsed = JSON.parse(body.driveServiceAccountJson) as {
        client_email?: string;
        private_key?: string;
      };
      if (!parsed.client_email || !parsed.private_key) {
        return NextResponse.json(
          {
            error:
              "El JSON de Google debe incluir client_email y private_key (cuenta de servicio)",
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "El JSON de la cuenta de servicio no es válido" },
        { status: 400 }
      );
    }
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
    driveEnabled: typeof body.driveEnabled === "boolean" ? body.driveEnabled : undefined,
    driveFolderId: typeof body.driveFolderId === "string" ? body.driveFolderId : undefined,
    driveServiceAccountJson:
      body.clearDriveCredentials === true
        ? ""
        : typeof body.driveServiceAccountJson === "string"
          ? body.driveServiceAccountJson
          : undefined,
  });

  return NextResponse.json(publicAppConfig(next));
}

/** Prueba webhook o Google Drive según `action`. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    webhookUrl?: string;
  };
  let config = await readAppConfig();

  if (body.action === "test_drive") {
    // Si hay carpeta + clave pero el switch está apagado, activarlo para la prueba
    if (
      !config.driveEnabled &&
      config.driveFolderId &&
      config.driveServiceAccountJson
    ) {
      config = await writeAppConfig({ driveEnabled: true });
    }
    if (!config.driveEnabled) {
      return NextResponse.json(
        {
          error:
            "Activa «Subir automáticamente cada JSON», pega el ID de carpeta y la clave, y pulsa Guardar",
        },
        { status: 400 }
      );
    }
    if (!config.driveFolderId || !config.driveServiceAccountJson) {
      return NextResponse.json(
        {
          error:
            "Falta el ID de carpeta o la clave JSON. Guarda ambos y vuelve a probar.",
        },
        { status: 400 }
      );
    }
    // Sube un JSON de prueba → si llega, la conexión es correcta → lo borra solo.
    const upload = await uploadJsonToDrive({
      fileName: `prueba-studio-${Date.now()}.json`,
      json: {
        ok: true,
        message: "Prueba de Video Extraction Studio → Google Drive",
        sent_at: new Date().toISOString(),
      },
    });
    if (!upload) {
      return NextResponse.json({ error: "Drive no está activo" }, { status: 400 });
    }
    if (!upload.ok || !upload.fileId) {
      return NextResponse.json({ ok: false, error: upload.error }, { status: 502 });
    }

    const deleted = await deleteDriveFile({ fileId: upload.fileId });
    return NextResponse.json({
      ok: true,
      fileId: upload.fileId,
      name: upload.name,
      webViewLink: upload.webViewLink,
      cleanedUp: deleted.ok,
      cleanupError: deleted.ok ? undefined : deleted.error,
      folderId: config.driveFolderId,
      clientEmail: (() => {
        try {
          return (
            (JSON.parse(config.driveServiceAccountJson) as { client_email?: string })
              .client_email || null
          );
        } catch {
          return null;
        }
      })(),
    });
  }

  const url = (body.webhookUrl || config.webhookUrl || "").trim();
  if (!url) {
    return NextResponse.json(
      { error: "Configura una URL de webhook primero" },
      { status: 400 }
    );
  }

  const processedAt = new Date().toISOString();
  const testJob: StoredVideo = {
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
          items: [{ text: "Esto es un evento de prueba." }],
          data: { text: "Esto es un evento de prueba." },
        },
      },
      timeline: [
        {
          module_id: "summary",
          module_title: "Resumen",
          text: "Esto es un evento de prueba.",
        },
      ],
      modules: [
        {
          id: "summary",
          title: "Resumen",
          status: "ok",
          summary: "Prueba de webhook",
          items: [{ text: "Esto es un evento de prueba." }],
        },
      ],
    },
  };

  const delivery = await deliverWebhook({
    event: "job.ready",
    webhookUrl: url,
    job: testJob,
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
