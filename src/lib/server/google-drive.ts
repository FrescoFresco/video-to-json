import { createHash, createSign, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  dataDirRoot,
  driveAuthMethod,
  hasDriveAuth,
  readAppConfig,
  writeAppConfig,
  type AppConfig,
} from "./app-config";
import { normalizeDriveFolderId } from "@/lib/drive-folder-id";

export { normalizeDriveFolderId } from "@/lib/drive-folder-id";

export type DriveUploadResult = {
  ok: boolean;
  fileId?: string;
  webViewLink?: string;
  name?: string;
  error?: string;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type DriveAuth = {
  token: string;
  label: string;
  method: "oauth" | "service_account";
};

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const OAUTH_SCOPES = ["openid", "email", DRIVE_SCOPE].join(" ");

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    const email =
      typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
    const key = typeof parsed.private_key === "string" ? parsed.private_key : "";
    if (!email.includes("@") || !key.includes("PRIVATE KEY")) return null;
    return {
      client_email: email,
      private_key: key.replace(/\\n/g, "\n"),
      token_uri:
        typeof parsed.token_uri === "string" ? parsed.token_uri.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPkcePair() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

type PendingOAuth = {
  state: string;
  verifier: string;
  redirectUri: string;
  createdAt: number;
};

function pendingOAuthPath() {
  return path.join(/*turbopackIgnore: true*/ dataDirRoot(), "oauth-pending.json");
}

export async function savePendingOAuth(pending: PendingOAuth) {
  const file = pendingOAuthPath();
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, JSON.stringify(pending), "utf8");
}

export async function readPendingOAuth(): Promise<PendingOAuth | null> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ pendingOAuthPath(), "utf8");
    const parsed = JSON.parse(raw) as PendingOAuth;
    if (!parsed?.state || !parsed?.verifier || !parsed?.redirectUri) return null;
    if (Date.now() - (parsed.createdAt || 0) > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingOAuth() {
  try {
    await unlink(/*turbopackIgnore: true*/ pendingOAuthPath());
  } catch {
    /* ignore */
  }
}

export function buildOAuthAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function redirectUriFromRequest(request: Request): string {
  const url = new URL(request.url);
  const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${host}${port}/api/drive/oauth/callback`;
}

export async function exchangeOAuthCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  email?: string;
}> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `OAuth token falló (${res.status})`
    );
  }

  let email: string | undefined;
  try {
    const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    const info = (await me.json().catch(() => ({}))) as { email?: string };
    if (typeof info.email === "string") email = info.email;
  } catch {
    /* optional */
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
    email,
  };
}

async function getServiceAccountToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: account.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${b64url(signer.sign(account.private_key))}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ||
        json.error ||
        `No se pudo autenticar con Google (${res.status})`
    );
  }
  return json.access_token;
}

async function refreshOAuthAccessToken(config: AppConfig): Promise<string> {
  if (!config.driveOAuthClientId || !config.driveOAuthClientSecret) {
    throw new Error(
      "Faltan Client ID / Client Secret de Google. Guárdalos en Conexiones → Drive."
    );
  }
  if (!config.driveOAuthRefreshToken) {
    throw new Error("No hay sesión de Google. Pulsa «Conectar con Google».");
  }

  const body = new URLSearchParams({
    client_id: config.driveOAuthClientId,
    client_secret: config.driveOAuthClientSecret,
    refresh_token: config.driveOAuthRefreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ||
        json.error ||
        "La sesión de Google caducó. Vuelve a pulsar «Conectar con Google»."
    );
  }
  const expiresAt = Date.now() + Math.max(60, (json.expires_in || 3600) - 60) * 1000;
  await writeAppConfig({
    driveOAuthAccessToken: json.access_token,
    driveOAuthAccessExpiresAt: expiresAt,
  });
  return json.access_token;
}

async function resolveDriveAuth(config: AppConfig): Promise<DriveAuth> {
  const method = driveAuthMethod(config);
  if (method === "oauth") {
    let token = config.driveOAuthAccessToken;
    if (
      !token ||
      !config.driveOAuthAccessExpiresAt ||
      Date.now() >= config.driveOAuthAccessExpiresAt
    ) {
      token = await refreshOAuthAccessToken(config);
    }
    return {
      token,
      label: config.driveOAuthEmail || "tu cuenta de Google",
      method: "oauth",
    };
  }

  if (method === "service_account") {
    const account = parseServiceAccount(config.driveServiceAccountJson);
    if (!account) {
      throw new Error(
        "La clave JSON de Google no es válida (debe incluir client_email y private_key)"
      );
    }
    return {
      token: await getServiceAccountToken(account),
      label: account.client_email,
      method: "service_account",
    };
  }

  throw new Error(
    "Drive no está conectado. Pulsa «Conectar con Google» o usa el modo avanzado."
  );
}

function safeFileName(name: string) {
  return (
    name.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/gi, "_").slice(0, 120) || "resultado"
  );
}

function explainDriveError(
  message: string,
  folderId: string,
  label: string,
  method: "oauth" | "service_account"
): string {
  const lower = (message || "").toLowerCase();

  if (
    lower.includes("storage quota") ||
    lower.includes("quota exceeded") ||
    lower.includes("storagequotaexceeded")
  ) {
    if (method === "service_account") {
      return (
        "Google no deja a las cuentas de servicio guardar en «Mi unidad». " +
        "Usa «Conectar con Google» (OAuth) para tu Gmail, o una Unidad compartida de Workspace."
      );
    }
    return "Sin espacio en esa cuenta de Google Drive. Libera espacio o elige otra carpeta.";
  }

  if (lower.includes("file not found") || lower.includes("not found") || lower.includes("404")) {
    if (method === "oauth") {
      return (
        `No encuentro la carpeta (${folderId.slice(0, 8)}…). ` +
        `Abre la carpeta en Drive con la misma cuenta (${label}) y pega la URL completa.`
      );
    }
    return (
      `No encuentro la carpeta (${folderId.slice(0, 8)}…). ` +
      `Comprueba el ID y compártela en Drive con «${label}» como editor.`
    );
  }

  if (lower.includes("insufficient") || lower.includes("permission") || lower.includes("403")) {
    if (method === "oauth") {
      return (
        `Sin permiso en esa carpeta con «${label}». ` +
        `Asegúrate de abrir la carpeta con esa misma cuenta de Google.`
      );
    }
    return `Sin permiso en esa carpeta. En Drive → Compartir → añade «${label}» como editor.`;
  }

  if (lower.includes("access not configured") || lower.includes("drive api")) {
    return "La API de Google Drive no está activada en ese proyecto de Google Cloud.";
  }
  return message;
}

async function assertFolderWritable(input: {
  token: string;
  folderId: string;
  label: string;
  method: "oauth" | "service_account";
}): Promise<{ ok: true; name?: string } | { ok: false; error: string }> {
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.folderId)}` +
    `?fields=id,name,mimeType,capabilities&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${input.token}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    mimeType?: string;
    capabilities?: { canAddChildren?: boolean };
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    return {
      ok: false,
      error: explainDriveError(
        json.error?.message || `Drive respondió HTTP ${res.status}`,
        input.folderId,
        input.label,
        input.method
      ),
    };
  }
  if (json.mimeType && json.mimeType !== "application/vnd.google-apps.folder") {
    return {
      ok: false,
      error: "Ese ID no es una carpeta de Drive. Abre la carpeta y copia el ID de la URL.",
    };
  }
  if (json.capabilities && json.capabilities.canAddChildren === false) {
    return {
      ok: false,
      error:
        input.method === "oauth"
          ? `Tu cuenta «${input.label}» no puede escribir en esa carpeta.`
          : `La cuenta «${input.label}» no puede escribir en esa carpeta. Compártela de nuevo como editor.`,
    };
  }
  return { ok: true, name: json.name };
}

function withForcedServiceAccount(
  config: AppConfig,
  serviceAccountJson?: string
): AppConfig {
  if (!serviceAccountJson?.trim()) return config;
  return {
    ...config,
    driveServiceAccountJson: serviceAccountJson.trim(),
    driveOAuthRefreshToken: "",
  };
}

/** Sube un JSON a la carpeta de Drive configurada (OAuth o cuenta de servicio). */
export async function uploadJsonToDrive(input: {
  fileName: string;
  json: unknown;
  folderId?: string;
  serviceAccountJson?: string;
}): Promise<DriveUploadResult | null> {
  let config = withForcedServiceAccount(await readAppConfig(), input.serviceAccountJson);
  if (!config.driveEnabled) return null;

  const folderId = normalizeDriveFolderId(input.folderId || config.driveFolderId || "");
  if (!folderId || !hasDriveAuth(config)) {
    return {
      ok: false,
      error:
        "Falta el ID de carpeta o la conexión con Google (Conectar con Google / modo avanzado)",
    };
  }

  try {
    const auth = await resolveDriveAuth(config);
    const folder = await assertFolderWritable({
      token: auth.token,
      folderId,
      label: auth.label,
      method: auth.method,
    });
    if (!folder.ok) return { ok: false, error: folder.error };

    const name = safeFileName(
      input.fileName.endsWith(".json") ? input.fileName : `${input.fileName}.json`
    );
    const metadata = {
      name,
      parents: [folderId],
      mimeType: "application/json",
    };
    const boundary = `vx_${Date.now().toString(36)}`;
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify(input.json, null, 2)}\r\n` +
      `--${boundary}--\r\n`;

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files" +
        "?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      webViewLink?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.id) {
      return {
        ok: false,
        error: explainDriveError(
          json.error?.message || `Drive respondió HTTP ${res.status}`,
          folderId,
          auth.label,
          auth.method
        ),
      };
    }
    return {
      ok: true,
      fileId: json.id,
      name: json.name,
      webViewLink: json.webViewLink,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo subir a Drive",
    };
  }
}

/** Borra un archivo de Drive (p. ej. prueba). */
export async function deleteDriveFile(input: {
  fileId: string;
  serviceAccountJson?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = withForcedServiceAccount(
    await readAppConfig(),
    input.serviceAccountJson
  );
  const fileId = input.fileId.trim();
  if (!fileId || !hasDriveAuth(config)) {
    return { ok: false, error: "Falta el archivo o la conexión con Google" };
  }

  try {
    const auth = await resolveDriveAuth(config);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      }
    );
    if (res.status === 204 || res.status === 404 || res.ok) {
      return { ok: true };
    }
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return {
      ok: false,
      error: json.error?.message || `Drive respondió HTTP ${res.status} al borrar`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo borrar en Drive",
    };
  }
}
