import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeDriveFolderId } from "@/lib/drive-folder-id";

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
  /** JSON completo de la cuenta de servicio (modo avanzado / Unidades compartidas). */
  driveServiceAccountJson: string;
  /** OAuth Client ID (Google Cloud → Credenciales). */
  driveOAuthClientId: string;
  /** OAuth Client Secret. */
  driveOAuthClientSecret: string;
  /** Refresh token tras «Conectar con Google». */
  driveOAuthRefreshToken: string;
  /** Access token en caché. */
  driveOAuthAccessToken: string;
  /** Epoch ms en que caduca el access token. */
  driveOAuthAccessExpiresAt: number;
  /** Email de la cuenta Google conectada por OAuth. */
  driveOAuthEmail: string;
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
  driveOAuthClientId: "",
  driveOAuthClientSecret: "",
  driveOAuthRefreshToken: "",
  driveOAuthAccessToken: "",
  driveOAuthAccessExpiresAt: 0,
  driveOAuthEmail: "",
};

export function dataDirRoot() {
  return process.env.VX_DATA_DIR
    ? path.dirname(process.env.VX_DATA_DIR)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
}

function configPath() {
  return path.join(/*turbopackIgnore: true*/ dataDirRoot(), "config.json");
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}


export function hasDriveAuth(config: AppConfig): boolean {
  return Boolean(
    config.driveOAuthRefreshToken?.trim() || config.driveServiceAccountJson?.trim()
  );
}

export function driveAuthMethod(
  config: AppConfig
): "oauth" | "service_account" | null {
  if (config.driveOAuthRefreshToken?.trim()) return "oauth";
  if (config.driveServiceAccountJson?.trim()) return "service_account";
  return null;
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      webhookUrl: asString(parsed.webhookUrl),
      webhookSecret: asString(parsed.webhookSecret),
      inboxPath: asString(parsed.inboxPath),
      outboxPath: asString(parsed.outboxPath),
      inboxEnabled: Boolean(parsed.inboxEnabled),
      driveEnabled: Boolean(parsed.driveEnabled),
      driveFolderId: normalizeDriveFolderId(asString(parsed.driveFolderId)),
      driveServiceAccountJson: asString(parsed.driveServiceAccountJson),
      driveOAuthClientId: asString(parsed.driveOAuthClientId),
      driveOAuthClientSecret: asString(parsed.driveOAuthClientSecret),
      driveOAuthRefreshToken: asString(parsed.driveOAuthRefreshToken),
      driveOAuthAccessToken: asString(parsed.driveOAuthAccessToken),
      driveOAuthAccessExpiresAt: asNumber(parsed.driveOAuthAccessExpiresAt),
      driveOAuthEmail: asString(parsed.driveOAuthEmail),
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
      driveFolderId: normalizeDriveFolderId(process.env.VX_DRIVE_FOLDER_ID || ""),
      driveServiceAccountJson: (process.env.VX_DRIVE_SERVICE_ACCOUNT_JSON || "").trim(),
      driveOAuthClientId: (process.env.VX_DRIVE_OAUTH_CLIENT_ID || "").trim(),
      driveOAuthClientSecret: (process.env.VX_DRIVE_OAUTH_CLIENT_SECRET || "").trim(),
    };
  }
}

/** Credenciales OAuth de la app (env o data/oauth-client.json). No van a la UI. */
export type OAuthClientCredentials = {
  clientId: string;
  clientSecret: string;
  source: "env" | "file" | "config" | null;
};

function oauthClientFilePath() {
  return path.join(/*turbopackIgnore: true*/ dataDirRoot(), "oauth-client.json");
}

async function readOAuthClientFile(): Promise<{ clientId: string; clientSecret: string } | null> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ oauthClientFilePath(), "utf8");
    const parsed = JSON.parse(raw) as { clientId?: string; clientSecret?: string; client_id?: string; client_secret?: string };
    const clientId = asString(parsed.clientId || parsed.client_id);
    const clientSecret = asString(parsed.clientSecret || parsed.client_secret);
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  } catch {
    return null;
  }
}

/** Resuelve Client ID/Secret: env → archivo local → config guardada. */
export async function resolveOAuthClient(
  config: AppConfig
): Promise<OAuthClientCredentials> {
  const cfg = config;
  const envId = asString(process.env.VX_DRIVE_OAUTH_CLIENT_ID);
  const envSecret = asString(process.env.VX_DRIVE_OAUTH_CLIENT_SECRET);
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, source: "env" };
  }
  const file = await readOAuthClientFile();
  if (file) {
    return { clientId: file.clientId, clientSecret: file.clientSecret, source: "file" };
  }
  if (cfg.driveOAuthClientId && cfg.driveOAuthClientSecret) {
    return {
      clientId: cfg.driveOAuthClientId,
      clientSecret: cfg.driveOAuthClientSecret,
      source: "config",
    };
  }
  return { clientId: "", clientSecret: "", source: null };
}

/** True si hay OAuth conectado o cuenta de servicio. */
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
        ? normalizeDriveFolderId(patch.driveFolderId)
        : current.driveFolderId,
    driveServiceAccountJson:
      typeof patch.driveServiceAccountJson === "string"
        ? patch.driveServiceAccountJson.trim()
        : current.driveServiceAccountJson,
    driveOAuthClientId:
      typeof patch.driveOAuthClientId === "string"
        ? patch.driveOAuthClientId.trim()
        : current.driveOAuthClientId,
    driveOAuthClientSecret:
      typeof patch.driveOAuthClientSecret === "string"
        ? patch.driveOAuthClientSecret.trim()
        : current.driveOAuthClientSecret,
    driveOAuthRefreshToken:
      typeof patch.driveOAuthRefreshToken === "string"
        ? patch.driveOAuthRefreshToken.trim()
        : current.driveOAuthRefreshToken,
    driveOAuthAccessToken:
      typeof patch.driveOAuthAccessToken === "string"
        ? patch.driveOAuthAccessToken.trim()
        : current.driveOAuthAccessToken,
    driveOAuthAccessExpiresAt:
      typeof patch.driveOAuthAccessExpiresAt === "number"
        ? patch.driveOAuthAccessExpiresAt
        : current.driveOAuthAccessExpiresAt,
    driveOAuthEmail:
      typeof patch.driveOAuthEmail === "string"
        ? patch.driveOAuthEmail.trim()
        : current.driveOAuthEmail,
  };
  // Si en este guardado hay carpeta + auth, activar Drive
  // (evita el fallo típico de rellenar todo y olvidar el checkbox).
  if (
    next.driveFolderId &&
    hasDriveAuth(next) &&
    (patch.driveFolderId !== undefined ||
      patch.driveServiceAccountJson !== undefined ||
      patch.driveOAuthRefreshToken !== undefined ||
      patch.driveEnabled === true)
  ) {
    if (patch.driveEnabled !== false) {
      next.driveEnabled = true;
    }
  }
  const file = configPath();
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(
    /*turbopackIgnore: true*/ file,
    JSON.stringify(next, null, 2),
    "utf8"
  );
  return next;
}

/** Respuesta segura para la UI (sin filtrar secretos). */
export function publicAppConfig(config: AppConfig) {
  let driveClientEmail: string | null = null;
  if (config.driveServiceAccountJson) {
    try {
      const parsed = JSON.parse(config.driveServiceAccountJson) as {
        client_email?: string;
      };
      driveClientEmail =
        typeof parsed.client_email === "string" ? parsed.client_email : null;
    } catch {
      driveClientEmail = null;
    }
  }
  const method = driveAuthMethod(config);
  const envId = asString(process.env.VX_DRIVE_OAUTH_CLIENT_ID);
  const envSecret = asString(process.env.VX_DRIVE_OAUTH_CLIENT_SECRET);
  const clientConfigured = Boolean(
    (envId && envSecret) ||
      (config.driveOAuthClientId && config.driveOAuthClientSecret)
  );
  return {
    webhookUrl: config.webhookUrl,
    webhookSecretSet: Boolean(config.webhookSecret),
    inboxPath: config.inboxPath,
    outboxPath: config.outboxPath,
    inboxEnabled: config.inboxEnabled,
    driveEnabled: config.driveEnabled,
    driveFolderId: config.driveFolderId,
    driveCredentialsSet: hasDriveAuth(config),
    driveAuthMethod: method,
    // Si ya hay credenciales de app, no hace falta que el usuario pegue Client ID
    driveOAuthClientConfigured: clientConfigured,
    driveOAuthClientId: envId ? "" : config.driveOAuthClientId,
    driveOAuthClientSecretSet: Boolean(envSecret || config.driveOAuthClientSecret),
    driveOAuthConnected: Boolean(config.driveOAuthRefreshToken),
    driveOAuthEmail: config.driveOAuthEmail || null,
    driveClientEmail:
      method === "oauth" ? config.driveOAuthEmail || null : driveClientEmail,
    driveRedirectUri: "http://127.0.0.1:43141/api/drive/oauth/callback",
  };
}
