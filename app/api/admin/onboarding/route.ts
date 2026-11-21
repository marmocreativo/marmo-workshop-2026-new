import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { run } from "@/lib/db";

const schema = z.union([z.object({ userId: z.string().min(1) }), z.object({ all: z.literal(true) })]);

// Reinicia el tutorial: la próxima vez que el usuario abra el Studio se le vuelve a mostrar.
export const POST = handle(async (req: Request) => {
  await adminAuthed();
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Indica un usuario o all: true");
  const rs = "userId" in p.data ? await run("UPDATE users SET onboarded=0 WHERE id=?", [p.data.userId]) : await run("UPDATE users SET onboarded=0");
  return Response.json({ ok: true, users: rs.rowsAffected });
});
