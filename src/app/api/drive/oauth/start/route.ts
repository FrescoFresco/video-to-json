import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readAppConfig, resolveOAuthClient } from "@/lib/server/app-config";
import {
  buildOAuthAuthorizeUrl,
  createPkcePair,
  redirectUriFromRequest,
  savePendingOAuth,
} from "@/lib/server/google-drive";

export const runtime = "nodejs";

function htmlError(message: string) {
  const safe = message.replace(/[<>&]/g, "");
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Google Drive</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#171719">
  <h1 style="font-size:18px;margin:0 0 8px">No se puede conectar con Google</h1>
  <p style="color:#b42318">${safe}</p>
  <p style="color:#75757d;font-size:13px">Cierra esta ventana, revisa Client ID / Secret en Conexiones → Drive, y vuelve a intentar.</p>
</body>
</html>`;
  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const config = await readAppConfig();
  const oauth = await resolveOAuthClient(config);
  if (!oauth.clientId || !oauth.clientSecret) {
    return htmlError(
      "Faltan Client ID y Client Secret de la app. Pégalos en Conexiones → Drive (setup una vez) o en data/oauth-client.json."
    );
  }

  const redirectUri = redirectUriFromRequest(request);
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkcePair();
  await savePendingOAuth({
    state,
    verifier,
    redirectUri,
    createdAt: Date.now(),
  });

  const url = buildOAuthAuthorizeUrl({
    clientId: oauth.clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });
  return NextResponse.redirect(url);
}
