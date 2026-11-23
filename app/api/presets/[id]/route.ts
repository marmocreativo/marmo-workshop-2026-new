import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, query, run } from "@/lib/db";
import { deleteStored, saveFile } from "@/lib/storage";

const patch = z.object({
  isPublic: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  freeText: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(1000).optional(),
  modifierIds: z.array(z.string()).max(60).optional(),
});

// JSON (nombre / público) o multipart (edición completa: nombre, texto, modificadores y portada).
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const current = await one<{ ref_file: string | null; free_text: string | null; modifier_ids: string; materials: string | null }>(
    "SELECT ref_file,free_text,modifier_ids,materials FROM presets WHERE id=? AND user_id=?",
    [id, user.id],
  );
  if (!current) throw new HttpError(404, "No encontrado");

  const multipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");
  let image: File | null = null;
  let removeImage = false;
  let newMaterials: File[] = [];
  let keepMaterials: string[] | null = null; // null = no tocar los materiales
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
      instructions: form.has("instructions") ? String(form.get("instructions")) : undefined,
      modifierIds: ids,
    };
    const img = form.get("image");
    if (img instanceof File && img.size > 0) image = img;
    removeImage = form.get("removeImage") === "1";
    if (form.has("keepMaterials")) {
      try {
        const k = JSON.parse(String(form.get("keepMaterials")));
        keepMaterials = Array.isArray(k) ? k.map(String) : [];
      } catch {
        throw new HttpError(400, "Materiales inválidos");
      }
      newMaterials = form.getAll("materials").filter((f): f is File => f instanceof File && f.size > 0);
    }
  } else {
    raw = await req.json();
  }
  const body = patch.parse(raw);

  if (body.isPublic !== undefined) await run("UPDATE presets SET is_public=? WHERE id=? AND user_id=?", [+body.isPublic, id, user.id]);
  if (body.instructions !== undefined) await run("UPDATE presets SET instructions=? WHERE id=? AND user_id=?", [body.instructions || null, id, user.id]);
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

  if (keepMaterials) {
    const before: string[] = current.materials ? JSON.parse(current.materials) : [];
    const kept = keepMaterials.filter((f) => before.includes(f));
    const room = Math.max(0, 3 - kept.length);
    const added: string[] = [];
    for (const f of newMaterials.slice(0, room)) {
      if (!f.type.startsWith("image/")) throw new HttpError(400, "Los materiales deben ser imágenes");
      if (f.size > 8 * 1024 * 1024) throw new HttpError(413, "Un material es muy pesado");
      added.push(await saveFile(user.id, Buffer.from(await f.arrayBuffer()), f.type === "image/png" ? "png" : "jpg"));
    }
    const all = [...kept, ...added];
    await run("UPDATE presets SET materials=? WHERE id=? AND user_id=?", [all.length ? JSON.stringify(all) : null, id, user.id]);
    for (const f of before.filter((x) => !kept.includes(x))) await deleteStored(f);
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
  const p = await one<{ ref_file: string | null; materials: string | null }>("SELECT ref_file,materials FROM presets WHERE id=? AND user_id=?", [id, user.id]);
  if (!p) throw new HttpError(404, "No encontrado");
  await run("DELETE FROM presets WHERE id=? AND user_id=?", [id, user.id]);
  if (p.ref_file) await deleteStored(p.ref_file);
  for (const f of p.materials ? (JSON.parse(p.materials) as string[]) : []) await deleteStored(f);
  return Response.json({ ok: true });
});
