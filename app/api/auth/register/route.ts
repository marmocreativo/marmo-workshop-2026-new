import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError, handle } from "@/lib/api";
import { adminEmail, seedUser, startSession } from "@/lib/auth";
import { applyDelta, getPricing } from "@/lib/billing";
import { one, run, uid } from "@/lib/db";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export const POST = handle(async (req: Request) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Correo inválido o contraseña menor a 8 caracteres");
  const email = parsed.data.email.toLowerCase();
  // El administrador no se crea desde el registro público (ver ensureAdmin).
  if (email === adminEmail()) throw new HttpError(403, "Ese correo está reservado");
  if (await one("SELECT id FROM users WHERE email=?", [email])) throw new HttpError(409, "Ese correo ya está registrado");
  const id = uid();
  await run("INSERT INTO users(id,email,password_hash,created_at,onboarded) VALUES(?,?,?,?,0)", [
    id,
    email,
    await bcrypt.hash(parsed.data.password, 10),
    Date.now(),
  ]);
  await seedUser(id);
  const { signupBonusTokens } = await getPricing();
  if (signupBonusTokens > 0) await applyDelta(id, signupBonusTokens, "signup_bonus", { ref: id, note: "Bono de bienvenida" });
  await startSession(id);
  return Response.json({ ok: true });
});
