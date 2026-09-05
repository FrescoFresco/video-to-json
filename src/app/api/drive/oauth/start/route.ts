import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { readAppConfig } from "@/lib/server/app-config";
import {
  buildOAuthAuthorizeUrl,
  createPkcePair,
  redirectUriFromRequest,
  savePendingOAuth,
} from "@/lib/server/google-drive";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = await readAppConfig();
  if (!config.driveOAuthClientId || !config.driveOAuthClientSecret) {
    return NextResponse.json(
      {
        error:
          "Primero guarda el Client ID y el Client Secret de Google en Conexiones → Drive.",
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
    clientId: config.driveOAuthClientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });
  return NextResponse.redirect(url);
}
