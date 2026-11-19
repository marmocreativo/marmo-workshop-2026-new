import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { applyDelta } from "@/lib/billing";
import { one } from "@/lib/db";

const schema = z.object({
  amount: z.number().int().refine((n) => n !== 0, "La cantidad no puede ser 0").refine((n) => Math.abs(n) <= 1_000_000),
  note: z.string().trim().min(3, "Escribe el motivo").max(200),
});

// Carga (o descuento) manual de tokens, con motivo y autor registrados en el libro de movimientos.
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await adminAuthed();
  const { id } = await params;
  if (!(await one("SELECT id FROM users WHERE id=?", [id]))) throw new HttpError(404, "Usuario no encontrado");
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Datos inválidos");
  const r = await applyDelta(id, p.data.amount, "admin_adjust", { note: p.data.note, actorId: admin.id, clamp: true });
  return Response.json({ applied: r.applied, balance: r.balance });
});
