import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { adminEmail, seedUser, startSession } from "@/lib/auth";
import { applyDelta, getPricing } from "@/lib/billing";
import { one, run, uid } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, googleEnabled, googleRedirectUri, publicUrl } from "@/lib/google";

const certs = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const back = (error?: string) => Response.redirect(publicUrl(error ? `/login?error=${error}` : "/studio"), 302);

// Paso 2: Google regresa con un código. Se valida, se canjea por el id_token y se inicia sesión (o se crea la cuenta).
export async function GET(req: Request) {
  if (!googleEnabled()) return back("google");
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = jar.get(GOOGLE_STATE_COOKIE)?.value;
  jar.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });

  if (url.searchParams.get("error")) return back("google_cancelled");
  const code = url.searchParams.get("code");
  let expected: { state: string; nonce: string } | null = null;
  try {
    expected = saved ? JSON.parse(saved) : null;
  } catch {
    expected = null;
  }
  if (!code || !expected || url.searchParams.get("state") !== expected.state) return back("google");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokenRes.ok || !tokens.id_token) return back("google");

    const { payload } = await jwtVerify(tokens.id_token, certs, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    if (payload.nonce !== expected.nonce) return back("google");
    const sub = String(payload.sub);
    const email = String(payload.email ?? "").toLowerCase();
    if (!email) return back("google");
    if (payload.email_verified !== true) return back("google_unverified");

    // Cuenta ya vinculada a Google, o cuenta existente con el mismo correo (verificado por Google): se vincula.
    let user = await one<{ id: string }>("SELECT id FROM users WHERE google_sub=?", [sub]);
    if (!user) {
      user = await one<{ id: string }>("SELECT id FROM users WHERE email=?", [email]);
      if (user) await run("UPDATE users SET google_sub=? WHERE id=?", [sub, user.id]);
    }
    if (!user) {
      const id = uid();
      // Sin contraseña propia: se guarda una aleatoria que nadie conoce (la columna es obligatoria).
      await run("INSERT INTO users(id,email,password_hash,role,google_sub,created_at,onboarded) VALUES(?,?,?,?,?,?,0)", [
        id,
        email,
        await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        email === adminEmail() ? "admin" : "user",
        sub,
        Date.now(),
      ]);
      await seedUser(id);
      const { signupBonusTokens } = await getPricing();
      if (signupBonusTokens > 0) await applyDelta(id, signupBonusTokens, "signup_bonus", { ref: id, note: "Bono de bienvenida" });
      user = { id };
    }
    await startSession(user.id);
    return back();
  } catch {
    return back("google");
  }
}
