import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { one, query, run } from "@/lib/db";
import { deleteStored } from "@/lib/storage";

const patch = z.object({ active: z.boolean().optional(), move: z.enum(["up", "down"]).optional() });

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await adminAuthed();
  const { id } = await params;
  const p = patch.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Datos inválidos");
  if (p.data.active !== undefined) await run("UPDATE hero_images SET active=? WHERE id=?", [p.data.active ? 1 : 0, id]);
  if (p.data.move) {
    // Se renumera todo el orden y se intercambia con el vecino.
    const all = await query<{ id: string }>("SELECT id FROM hero_images ORDER BY sort, created_at");
    const i = all.findIndex((x) => x.id === id);
    const j = p.data.move === "up" ? i - 1 : i + 1;
    if (i < 0) throw new HttpError(404, "No encontrada");
    if (j >= 0 && j < all.length) [all[i], all[j]] = [all[j], all[i]];
    for (let k = 0; k < all.length; k++) await run("UPDATE hero_images SET sort=? WHERE id=?", [k, all[k].id]);
  }
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await adminAuthed();
  const { id } = await params;
  const h = await one<{ file: string }>("SELECT file FROM hero_images WHERE id=?", [id]);
  if (!h) throw new HttpError(404, "No encontrada");
  await run("DELETE FROM hero_images WHERE id=?", [id]);
  await deleteStored(h.file);
  return Response.json({ ok: true });
});
