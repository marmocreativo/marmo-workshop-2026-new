import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError, handle } from "@/lib/api";
import { ensureAdmin, startSession } from "@/lib/auth";
import { one } from "@/lib/db";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = handle(async (req: Request) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Datos inválidos");
  await ensureAdmin();
  const user = await one<{ id: string; password_hash: string }>(
    "SELECT id,password_hash FROM users WHERE email=?",
    [parsed.data.email.toLowerCase()],
  );
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash)))
    throw new HttpError(401, "Correo o contraseña incorrectos");
  await startSession(user.id);
  return Response.json({ ok: true });
});
