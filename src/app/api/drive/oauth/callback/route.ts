import { NextResponse } from "next/server";
import {
  readAppConfig,
  resolveOAuthClient,
  writeAppConfig,
} from "@/lib/server/app-config";
import {
  clearPendingOAuth,
  exchangeOAuthCode,
  readPendingOAuth,
} from "@/lib/server/google-drive";

export const runtime = "nodejs";

function finishHtml(input: {
  ok: boolean;
  message: string;
  href: string;
}) {
  const payload = JSON.stringify({
    type: "vx-drive-oauth",
    ok: input.ok,
    message: input.message,
  });
  const href = JSON.stringify(input.href);
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Google Drive</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#171719">
  <p>${input.ok ? "Conectado con Google. Puedes cerrar esta ventana." : "No se pudo conectar con Google."}</p>
  <p style="color:#75757d;font-size:13px">${input.message.replace(/[<>&]/g, "")}</p>
  <script>
    (function () {
      var payload = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
          window.close();
          return;
        }
      } catch (e) {}
      location.href = ${href};
    })();
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function appHref(request: Request, query: Record<string, string>) {
  const url = new URL(request.url);
  const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  const port = url.port ? `:${url.port}` : "";
  const target = new URL(`${url.protocol}//${host}${port}/`);
  target.searchParams.set("view", "connections");
  target.searchParams.set("panel", "drive");
  for (const [k, v] of Object.entries(query)) {
    target.searchParams.set(k, v);
  }
  return target.toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");
  if (error) {
    await clearPendingOAuth();
    const message = errorDesc || error;
    return finishHtml({
      ok: false,
      message,
      href: appHref(request, {
        drive_oauth: "error",
        drive_oauth_msg: message,
      }),
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return finishHtml({
      ok: false,
      message: "Falta el código de Google. Vuelve a intentar Conectar.",
      href: appHref(request, {
        drive_oauth: "error",
        drive_oauth_msg: "Falta el código de Google.",
      }),
    });
  }

  const pending = await readPendingOAuth();
  if (!pending || pending.state !== state) {
    await clearPendingOAuth();
    return finishHtml({
      ok: false,
      message: "La sesión de conexión caducó. Pulsa Conectar otra vez.",
      href: appHref(request, {
        drive_oauth: "error",
        drive_oauth_msg: "Sesión caducada. Vuelve a conectar.",
      }),
    });
  }

  try {
    const config = await readAppConfig();
    const oauth = await resolveOAuthClient(config);
    if (!oauth.clientId || !oauth.clientSecret) {
      throw new Error("Faltan las credenciales OAuth de la app.");
    }

    const tokens = await exchangeOAuthCode({
      code,
      redirectUri: pending.redirectUri,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      codeVerifier: pending.verifier,
    });

    if (!tokens.refresh_token && !config.driveOAuthRefreshToken) {
      throw new Error(
        "Google no devolvió refresh_token. Revoca el acceso en tu cuenta de Google y vuelve a conectar."
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
      driveServiceAccountJson: "",
      driveEnabled: Boolean(config.driveFolderId) || config.driveEnabled,
    });

    await clearPendingOAuth();
    const message = tokens.email
      ? `Conectado como ${tokens.email}`
      : "Google conectado";
    return finishHtml({
      ok: true,
      message,
      href: appHref(request, {
        drive_oauth: "ok",
        drive_oauth_msg: message,
      }),
    });
  } catch (err) {
    await clearPendingOAuth();
    const message =
      err instanceof Error ? err.message : "No se pudo completar el login de Google";
    return finishHtml({
      ok: false,
      message,
      href: appHref(request, {
        drive_oauth: "error",
        drive_oauth_msg: message,
      }),
    });
  }
}
