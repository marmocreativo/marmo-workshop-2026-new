import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, query, run } from "@/lib/db";
import { deleteStored, saveFile } from "@/lib/storage";

const patch = z.object({
  isPublic: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  freeText: z.string().trim().max(1000).optional(),
  modifierIds: z.array(z.string()).max(60).optional(),
});

// JSON (nombre / público) o multipart (edición completa: nombre, texto, modificadores y portada).
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const current = await one<{ ref_file: string | null; free_text: string | null; modifier_ids: string }>(
    "SELECT ref_file,free_text,modifier_ids FROM presets WHERE id=? AND user_id=?",
    [id, user.id],
  );
  if (!current) throw new HttpError(404, "No encontrado");

  const multipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");
  let image: File | null = null;
  let removeImage = false;
  let raw: Record<string, unknown>;
  if (multipart) {
    const form = await req.formData();
    let ids: unknown = undefined;
    if (form.has("modifierIds")) {
      try {
        ids = JSON.parse(String(form.get("modifierIds")));
      } catch {
        throw new HttpError(400, "Modificadores inválidos");
      }
    }
    raw = {
      name: form.get("name") ?? undefined,
      freeText: form.has("freeText") ? String(form.get("freeText")) : undefined,
      modifierIds: ids,
    };
    const img = form.get("image");
    if (img instanceof File && img.size > 0) image = img;
    removeImage = form.get("removeImage") === "1";
  } else {
    raw = await req.json();
  }
  const body = patch.parse(raw);

  if (body.isPublic !== undefined) await run("UPDATE presets SET is_public=? WHERE id=? AND user_id=?", [+body.isPublic, id, user.id]);
  if (body.name) await run("UPDATE presets SET name=? WHERE id=? AND user_id=?", [body.name, id, user.id]);

  if (body.modifierIds !== undefined || body.freeText !== undefined) {
    const freeText = body.freeText !== undefined ? body.freeText || null : current.free_text;
    let ids: string[] = JSON.parse(current.modifier_ids);
    if (body.modifierIds !== undefined) {
      // Solo modificadores propios.
      const own = await query<{ id: string }>(
        `SELECT id FROM modifiers WHERE user_id=? AND id IN (${body.modifierIds.map(() => "?").join(",") || "''"})`,
        [user.id, ...body.modifierIds],
      );
      ids = body.modifierIds.filter((m) => own.some((o) => o.id === m));
    }
    if (!ids.length && !freeText) throw new HttpError(400, "Elige al menos un modificador o escribe un texto");
    await run("UPDATE presets SET free_text=?, modifier_ids=? WHERE id=? AND user_id=?", [freeText, JSON.stringify(ids), id, user.id]);
  }

  if (image) {
    if (!image.type.startsWith("image/")) throw new HttpError(400, "La portada debe ser una imagen");
    if (image.size > 6 * 1024 * 1024) throw new HttpError(413, "La imagen es muy pesada");
    const file = await saveFile(user.id, Buffer.from(await image.arrayBuffer()), image.type === "image/png" ? "png" : "jpg");
    await run("UPDATE presets SET ref_file=? WHERE id=? AND user_id=?", [file, id, user.id]);
    if (current.ref_file) await deleteStored(current.ref_file);
  } else if (removeImage && current.ref_file) {
    await run("UPDATE presets SET ref_file=NULL WHERE id=? AND user_id=?", [id, user.id]);
    await deleteStored(current.ref_file);
  }
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
