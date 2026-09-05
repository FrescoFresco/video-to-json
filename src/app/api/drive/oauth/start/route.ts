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

export async function GET(request: Request) {
  const config = await readAppConfig();
  const oauth = await resolveOAuthClient(config);
  if (!oauth.clientId || !oauth.clientSecret) {
    return NextResponse.json(
      {
        error:
          "Faltan las credenciales OAuth de la app. Configura VX_DRIVE_OAUTH_CLIENT_ID / VX_DRIVE_OAUTH_CLIENT_SECRET o el archivo data/oauth-client.json.",
      },
      { status: 400 }
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
