import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError, handle } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { one, run } from "@/lib/db";

const schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8) });

export const POST = handle(async (req: Request) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres");
  const row = await one<{ user_id: string; expires_at: number }>("SELECT user_id,expires_at FROM password_resets WHERE token_hash=?", [
    createHash("sha256").update(parsed.data.token).digest("hex"),
  ]);
  if (!row || row.expires_at < Date.now()) throw new HttpError(400, "El enlace venció o ya se usó. Pide uno nuevo.");
  await run("UPDATE users SET password_hash=? WHERE id=?", [await bcrypt.hash(parsed.data.password, 10), row.user_id]);
  await run("DELETE FROM password_resets WHERE user_id=?", [row.user_id]);
  await startSession(row.user_id);
  return Response.json({ ok: true });
});
