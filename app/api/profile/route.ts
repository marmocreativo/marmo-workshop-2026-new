import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, run } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().max(80),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-.\s]*$/, "Teléfono no válido"),
});

// Datos personales del usuario en sesión.
export const GET = handle(async () => {
  const user = await authed();
  const row = await one<{ name: string | null; phone: string | null; google_sub: string | null; created_at: number }>(
    "SELECT name,phone,google_sub,created_at FROM users WHERE id=?",
    [user.id],
  );
  return Response.json({
    email: user.email,
    name: row?.name ?? "",
    phone: row?.phone ?? "",
    google: !!row?.google_sub,
    created_at: row?.created_at ?? null,
  });
});

export const PATCH = handle(async (req: Request) => {
  const user = await authed();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { name, phone } = parsed.data;
  await run("UPDATE users SET name=?, phone=? WHERE id=?", [name || null, phone || null, user.id]);
  return Response.json({ ok: true });
});
