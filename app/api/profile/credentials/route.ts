import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, run } from "@/lib/db";

const schema = z.object({
  currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
  email: z.string().email("Correo no válido").optional(),
  newPassword: z.string().min(8, "La contraseña nueva debe tener al menos 8 caracteres").optional(),
});

// Cambio de correo o de contraseña: siempre exige la contraseña actual.
export const POST = handle(async (req: Request) => {
  const user = await authed();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { currentPassword, email, newPassword } = parsed.data;
  if (!email && !newPassword) throw new HttpError(400, "No hay nada que cambiar");

  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=?", [user.id]);
  if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) throw new HttpError(403, "La contraseña actual no es correcta");

  if (email) {
    // La cuenta de administrador se identifica por ADMIN_EMAIL: su correo se cambia en la configuración del servidor.
    if (user.role === "admin") throw new HttpError(400, "El correo del administrador no se puede cambiar desde aquí");
    const next = email.toLowerCase();
    if (next !== user.email) {
      if (await one("SELECT 1 FROM users WHERE email=? AND id<>?", [next, user.id])) throw new HttpError(409, "Ese correo ya está en uso");
      await run("UPDATE users SET email=? WHERE id=?", [next, user.id]);
    }
  }
  if (newPassword) await run("UPDATE users SET password_hash=? WHERE id=?", [await bcrypt.hash(newPassword, 10), user.id]);
  return Response.json({ ok: true });
});
