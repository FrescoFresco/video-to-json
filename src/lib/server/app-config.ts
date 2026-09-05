import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AppConfig = {
  webhookUrl: string;
  /** Cabecera opcional Authorization (ej. Bearer xxx). */
  webhookSecret: string;
  /** Carpeta de entrada: vídeos nuevos se procesan solos (útil con Google Drive Desktop). */
  inboxPath: string;
  /** Carpeta de salida: aquí se escriben los JSON. */
  outboxPath: string;
  /** Si true, vigila la carpeta inbox. */
  inboxEnabled: boolean;
};

const DEFAULT_CONFIG: AppConfig = {
  webhookUrl: "",
  webhookSecret: "",
  inboxPath: "",
  outboxPath: "",
  inboxEnabled: false,
};

function configPath() {
  const root = process.env.VX_DATA_DIR
    ? path.dirname(process.env.VX_DATA_DIR)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  return path.join(/*turbopackIgnore: true*/ root, "config.json");
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      webhookUrl: typeof parsed.webhookUrl === "string" ? parsed.webhookUrl.trim() : "",
      webhookSecret:
        typeof parsed.webhookSecret === "string" ? parsed.webhookSecret.trim() : "",
      inboxPath: typeof parsed.inboxPath === "string" ? parsed.inboxPath.trim() : "",
      outboxPath: typeof parsed.outboxPath === "string" ? parsed.outboxPath.trim() : "",
      inboxEnabled: Boolean(parsed.inboxEnabled),
    };
  } catch {
    const fromEnv = (process.env.WEBHOOK_URL || "").trim();
    return {
      ...DEFAULT_CONFIG,
      webhookUrl: fromEnv,
      webhookSecret: (process.env.WEBHOOK_SECRET || "").trim(),
      inboxPath: (process.env.VX_INBOX || "").trim(),
      outboxPath: (process.env.VX_OUTBOX || "").trim(),
      inboxEnabled: process.env.VX_INBOX_ENABLED === "1" || Boolean(process.env.VX_INBOX),
    };
  }
}

export async function writeAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readAppConfig();
  const next: AppConfig = {
    webhookUrl:
      typeof patch.webhookUrl === "string" ? patch.webhookUrl.trim() : current.webhookUrl,
    webhookSecret:
      typeof patch.webhookSecret === "string"
        ? patch.webhookSecret.trim()
        : current.webhookSecret,
    inboxPath:
      typeof patch.inboxPath === "string" ? patch.inboxPath.trim() : current.inboxPath,
    outboxPath:
      typeof patch.outboxPath === "string" ? patch.outboxPath.trim() : current.outboxPath,
    inboxEnabled:
      typeof patch.inboxEnabled === "boolean" ? patch.inboxEnabled : current.inboxEnabled,
  };
  const file = configPath();
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(
    /*turbopackIgnore: true*/ file,
    JSON.stringify(next, null, 2),
    "utf8"
  );
  return next;
}
