import type { StoredVideo, VideoJobResult } from "@/lib/types";
import { readAppConfig } from "./app-config";

export type WebhookEvent = "job.ready" | "job.error";

export type WebhookPayload = {
  event: WebhookEvent;
  sent_at: string;
  job: {
    id: string;
    name: string;
    status: StoredVideo["status"];
    createdAt: string;
    error?: string;
  };
  /** JSON de extracción cuando el job terminó bien. */
  extraction?: VideoJobResult["extraction"] | null;
  result?: VideoJobResult | null;
};

export type WebhookDelivery = {
  ok: boolean;
  url: string;
  status?: number;
  error?: string;
};

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function deliverWebhook(input: {
  event: WebhookEvent;
  job: StoredVideo;
  result?: VideoJobResult | null;
  /** Sobrescribe la URL global (p. ej. por trabajo). */
  webhookUrl?: string | null;
}): Promise<WebhookDelivery | null> {
  const config = await readAppConfig();
  const url = (input.webhookUrl || config.webhookUrl || "").trim();
  if (!url) return null;
  if (!isHttpUrl(url)) {
    return { ok: false, url, error: "URL de webhook inválida" };
  }

  const payload: WebhookPayload = {
    event: input.event,
    sent_at: new Date().toISOString(),
    job: {
      id: input.job.id,
      name: input.job.name,
      status: input.job.status,
      createdAt: input.job.createdAt,
      error: input.job.error,
    },
    extraction: input.result?.extraction ?? input.job.extraction ?? null,
    result: input.result ?? null,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "video-extraction-studio-webhook/1.0",
    "X-VX-Event": input.event,
  };
  if (config.webhookSecret) {
    headers.Authorization = config.webhookSecret.startsWith("Bearer ")
      ? config.webhookSecret
      : `Bearer ${config.webhookSecret}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        url,
        status: res.status,
        error: body.slice(0, 200) || `HTTP ${res.status}`,
      };
    }
    return { ok: true, url, status: res.status };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : "No se pudo enviar el webhook",
    };
  }
}
