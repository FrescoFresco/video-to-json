import { createSign } from "node:crypto";
import { readAppConfig } from "./app-config";
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

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount> & {
      client_email?: string;
      private_key?: string;
    };
    const email =
      typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
    const key = typeof parsed.private_key === "string" ? parsed.private_key : "";
    if (!email.includes("@") || !key.includes("PRIVATE KEY")) {
      return null;
    }
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

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // `drive` (no solo drive.file): hace falta para carpetas compartidas con la cuenta de servicio
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/drive",
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

function explainDriveError(message: string, folderId: string, clientEmail: string): string {
  const m = message || "";
  const lower = m.toLowerCase();
  if (
    lower.includes("file not found") ||
    lower.includes("not found") ||
    lower.includes("404")
  ) {
    return (
      `No encuentro la carpeta (${folderId.slice(0, 8)}…). ` +
      `Comprueba el ID y compártela en Drive con «${clientEmail}» como editor.`
    );
  }
  if (lower.includes("insufficient") || lower.includes("permission") || lower.includes("403")) {
    return (
      `Sin permiso en esa carpeta. En Drive → Compartir → añade «${clientEmail}» como editor.`
    );
  }
  if (lower.includes("access not configured") || lower.includes("drive api")) {
    return "La API de Google Drive no está activada en ese proyecto de Google Cloud.";
  }
  return m;
}

/** Comprueba que la cuenta de servicio ve la carpeta y puede escribir. */
async function assertFolderWritable(input: {
  token: string;
  folderId: string;
  clientEmail: string;
}): Promise<{ ok: true; name?: string } | { ok: false; error: string }> {
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.folderId)}` +
    `?fields=id,name,mimeType,capabilities` +
    `&supportsAllDrives=true`;
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
        input.clientEmail
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
        `La cuenta «${input.clientEmail}» no puede escribir en esa carpeta. ` +
        `Compártela de nuevo como editor.`,
    };
  }
  return { ok: true, name: json.name };
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

  const folderId = normalizeDriveFolderId(
    input.folderId || config.driveFolderId || ""
  );
  const saRaw = (input.serviceAccountJson || config.driveServiceAccountJson || "").trim();
  if (!folderId || !saRaw) {
    return {
      ok: false,
      error: "Falta el ID de carpeta o la clave de la cuenta de servicio",
    };
  }

  const account = parseServiceAccount(saRaw);
  if (!account) {
    return {
      ok: false,
      error:
        "La clave JSON de Google no es válida (debe incluir client_email y private_key)",
    };
  }

  try {
    const token = await getAccessToken(account);
    const folder = await assertFolderWritable({
      token,
      folderId,
      clientEmail: account.client_email,
    });
    if (!folder.ok) {
      return { ok: false, error: folder.error };
    }

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
        error: explainDriveError(
          json.error?.message || `Drive respondió HTTP ${res.status}`,
          folderId,
          account.client_email
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

/** Borra un archivo de Drive creado por la cuenta de servicio (p. ej. prueba). */
export async function deleteDriveFile(input: {
  fileId: string;
  serviceAccountJson?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const config = await readAppConfig();
  const saRaw = (input.serviceAccountJson || config.driveServiceAccountJson || "").trim();
  const fileId = input.fileId.trim();
  if (!fileId || !saRaw) {
    return { ok: false, error: "Falta el archivo o la clave de Google" };
  }

  const account = parseServiceAccount(saRaw);
  if (!account) {
    return { ok: false, error: "La clave JSON de Google no es válida" };
  }

  try {
    const token = await getAccessToken(account);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
