import { NextResponse } from "next/server";
import { readAppConfig, writeAppConfig } from "@/lib/server/app-config";
import {
  clearPendingOAuth,
  exchangeOAuthCode,
  readPendingOAuth,
} from "@/lib/server/google-drive";

export const runtime = "nodejs";

function appRedirect(request: Request, query: Record<string, string>) {
  const url = new URL(request.url);
  const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  const port = url.port ? `:${url.port}` : "";
  const target = new URL(`${url.protocol}//${host}${port}/`);
  target.searchParams.set("view", "connections");
  target.searchParams.set("panel", "drive");
  for (const [k, v] of Object.entries(query)) {
    target.searchParams.set(k, v);
  }
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");
  if (error) {
    await clearPendingOAuth();
    return appRedirect(request, {
      drive_oauth: "error",
      drive_oauth_msg: errorDesc || error,
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return appRedirect(request, {
      drive_oauth: "error",
      drive_oauth_msg: "Falta el código de Google. Vuelve a intentar Conectar.",
    });
  }

  const pending = await readPendingOAuth();
  if (!pending || pending.state !== state) {
    await clearPendingOAuth();
    return appRedirect(request, {
      drive_oauth: "error",
      drive_oauth_msg: "La sesión de conexión caducó. Pulsa Conectar otra vez.",
    });
  }

  try {
    const config = await readAppConfig();
    if (!config.driveOAuthClientId || !config.driveOAuthClientSecret) {
      throw new Error("Faltan Client ID / Client Secret guardados.");
    }

    const tokens = await exchangeOAuthCode({
      code,
      redirectUri: pending.redirectUri,
      clientId: config.driveOAuthClientId,
      clientSecret: config.driveOAuthClientSecret,
      codeVerifier: pending.verifier,
    });

    if (!tokens.refresh_token && !config.driveOAuthRefreshToken) {
      throw new Error(
        "Google no devolvió refresh_token. Revoca el acceso en tu cuenta Google y vuelve a conectar."
      );
    }

    const expiresAt =
      Date.now() + Math.max(60, (tokens.expires_in || 3600) - 60) * 1000;

    await writeAppConfig({
      driveOAuthAccessToken: tokens.access_token,
      driveOAuthAccessExpiresAt: expiresAt,
      ...(tokens.refresh_token
        ? { driveOAuthRefreshToken: tokens.refresh_token }
        : {}),
      ...(tokens.email ? { driveOAuthEmail: tokens.email } : {}),
      // Preferir OAuth: quitar cuenta de servicio para evitar confusión
      driveServiceAccountJson: "",
      driveEnabled: Boolean(config.driveFolderId) || config.driveEnabled,
    });

    await clearPendingOAuth();
    return appRedirect(request, {
      drive_oauth: "ok",
      drive_oauth_msg: tokens.email
        ? `Conectado como ${tokens.email}`
        : "Google conectado",
    });
  } catch (err) {
    await clearPendingOAuth();
    return appRedirect(request, {
      drive_oauth: "error",
      drive_oauth_msg:
        err instanceof Error ? err.message : "No se pudo completar el login de Google",
    });
  }
}
