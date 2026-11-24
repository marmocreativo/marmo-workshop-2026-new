import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { HttpError, handle } from "@/lib/api";
import { one, run } from "@/lib/db";
import { publicUrl } from "@/lib/google";
import { mailEnabled, sendMail } from "@/lib/mail";

const schema = z.object({ email: z.string().email() });
const TTL = 60 * 60 * 1000; // el enlace dura 1 hora

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

// Envía un enlace para crear una contraseña nueva. Responde igual exista o no el correo (no revela quién tiene cuenta).
export const POST = handle(async (req: Request) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Escribe un correo válido");
  if (!mailEnabled()) throw new HttpError(503, "La recuperación por correo no está disponible por ahora");
  const email = parsed.data.email.toLowerCase();

  const user = await one<{ id: string }>("SELECT id FROM users WHERE email=?", [email]);
  if (user) {
    // Máximo un correo por minuto por cuenta.
    const recent = await one("SELECT 1 FROM password_resets WHERE user_id=? AND expires_at>?", [user.id, Date.now() + TTL - 60_000]);
    if (!recent) {
      const token = randomBytes(32).toString("hex");
      await run("DELETE FROM password_resets WHERE user_id=?", [user.id]);
      await run("INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)", [hashToken(token), user.id, Date.now() + TTL]);
      const link = publicUrl(`/restablecer?token=${token}`);
      await sendMail({
        to: email,
        subject: "Restablece tu contraseña · Marmo Workshop",
        text: `Hola, soy Alma 🌸\n\nPara crear una contraseña nueva abre este enlace (dura 1 hora):\n${link}\n\nSi no lo pediste tú, ignora este correo: tu contraseña sigue igual.`,
        html: `<p>Hola, soy Alma 🌸</p><p>Para crear una contraseña nueva pulsa el botón (el enlace dura 1 hora):</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Crear contraseña nueva</a></p><p style="color:#666;font-size:13px">Si no lo pediste tú, ignora este correo: tu contraseña sigue igual.</p>`,
      });
    }
  }
  return Response.json({ ok: true });
});
