import { createSign } from "node:crypto";
import { readAppConfig } from "./app-config";

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

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (
      typeof parsed.client_email !== "string" ||
      !parsed.client_email.includes("@") ||
      typeof parsed.private_key !== "string" ||
      !parsed.private_key.includes("PRIVATE KEY")
    ) {
      return null;
    }
    return {
      client_email: parsed.client_email.trim(),
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
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

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: account.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = b64url(signer.sign(account.private_key));
  const assertion = `${unsigned}.${signature}`;

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

function safeFileName(name: string) {
  return name.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/gi, "_").slice(0, 120) || "resultado";
}

/** Sube un JSON a la carpeta de Drive configurada (cuenta de servicio). */
export async function uploadJsonToDrive(input: {
  fileName: string;
  json: unknown;
  folderId?: string;
  serviceAccountJson?: string;
}): Promise<DriveUploadResult | null> {
  const config = await readAppConfig();
  if (!config.driveEnabled) return null;

  const folderId = (input.folderId || config.driveFolderId || "").trim();
  const saRaw = (input.serviceAccountJson || config.driveServiceAccountJson || "").trim();
  if (!folderId || !saRaw) {
    return {
      ok: false,
      error: "Falta el ID de carpeta o la clave de la cuenta de servicio",
    };
  }

  const account = parseServiceAccount(saRaw);
  if (!account) {
    return { ok: false, error: "La clave JSON de Google no es válida" };
  }

  try {
    const token = await getAccessToken(account);
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
      `--${boundary}--`;

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
        error: json.error?.message || `Drive respondió HTTP ${res.status}`,
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
