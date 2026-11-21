import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { GOOGLE_STATE_COOKIE, googleEnabled, googleRedirectUri, publicUrl } from "@/lib/google";

// Paso 1: manda al usuario a Google. El state y el nonce viajan también en una cookie para validarlos al volver.
export async function GET() {
  if (!googleEnabled()) return Response.redirect(publicUrl("/login?error=google"), 302);
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  (await cookies()).set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, nonce }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 60 * 10,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
  }).toString();
  return Response.redirect(url.toString(), 302);
}
