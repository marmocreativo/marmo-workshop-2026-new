import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, run } from "@/lib/db";
import { deleteStored } from "@/lib/storage";

const patch = z.object({ isPublic: z.boolean().optional(), name: z.string().trim().min(1).max(60).optional() });

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const body = patch.parse(await req.json());
  const owned = await one("SELECT 1 FROM presets WHERE id=? AND user_id=?", [id, user.id]);
  if (!owned) throw new HttpError(404, "No encontrado");
  if (body.isPublic !== undefined) await run("UPDATE presets SET is_public=? WHERE id=? AND user_id=?", [+body.isPublic, id, user.id]);
  if (body.name) await run("UPDATE presets SET name=? WHERE id=? AND user_id=?", [body.name, id, user.id]);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const p = await one<{ ref_file: string | null }>("SELECT ref_file FROM presets WHERE id=? AND user_id=?", [id, user.id]);
  if (!p) throw new HttpError(404, "No encontrado");
  await run("DELETE FROM presets WHERE id=? AND user_id=?", [id, user.id]);
  if (p.ref_file) await deleteStored(p.ref_file);
  return Response.json({ ok: true });
});
