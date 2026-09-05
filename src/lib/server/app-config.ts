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
  /** Subir cada JSON a Google Drive (API) al terminar. */
  driveEnabled: boolean;
  /** ID de la carpeta de Drive (el de la URL). */
  driveFolderId: string;
  /** JSON completo de la cuenta de servicio de Google Cloud. */
  driveServiceAccountJson: string;
};

const DEFAULT_CONFIG: AppConfig = {
  webhookUrl: "",
  webhookSecret: "",
  inboxPath: "",
  outboxPath: "",
  inboxEnabled: false,
  driveEnabled: false,
  driveFolderId: "",
  driveServiceAccountJson: "",
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
      driveEnabled: Boolean(parsed.driveEnabled),
      driveFolderId:
        typeof parsed.driveFolderId === "string" ? parsed.driveFolderId.trim() : "",
      driveServiceAccountJson:
        typeof parsed.driveServiceAccountJson === "string"
          ? parsed.driveServiceAccountJson.trim()
          : "",
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
      driveEnabled: process.env.VX_DRIVE_ENABLED === "1",
      driveFolderId: (process.env.VX_DRIVE_FOLDER_ID || "").trim(),
      driveServiceAccountJson: (process.env.VX_DRIVE_SERVICE_ACCOUNT_JSON || "").trim(),
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
    driveEnabled:
      typeof patch.driveEnabled === "boolean" ? patch.driveEnabled : current.driveEnabled,
    driveFolderId:
      typeof patch.driveFolderId === "string"
        ? patch.driveFolderId.trim()
        : current.driveFolderId,
    driveServiceAccountJson:
      typeof patch.driveServiceAccountJson === "string"
        ? patch.driveServiceAccountJson.trim()
        : current.driveServiceAccountJson,
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

/** Respuesta segura para la UI (sin filtrar la clave privada). */
export function publicAppConfig(config: AppConfig) {
  let driveClientEmail: string | null = null;
  if (config.driveServiceAccountJson) {
    try {
      const parsed = JSON.parse(config.driveServiceAccountJson) as { client_email?: string };
      driveClientEmail =
        typeof parsed.client_email === "string" ? parsed.client_email : null;
    } catch {
      driveClientEmail = null;
    }
  }
  return {
    webhookUrl: config.webhookUrl,
    webhookSecretSet: Boolean(config.webhookSecret),
    inboxPath: config.inboxPath,
    outboxPath: config.outboxPath,
    inboxEnabled: config.inboxEnabled,
    driveEnabled: config.driveEnabled,
    driveFolderId: config.driveFolderId,
    driveCredentialsSet: Boolean(config.driveServiceAccountJson),
    driveClientEmail,
  };
}
