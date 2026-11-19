import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, query, run, uid } from "@/lib/db";
import { readStored, saveFile } from "@/lib/storage";
import type { Preset } from "@/lib/types";

type Row = Omit<Preset, "modifier_ids"> & { modifier_ids: string };

const parse = (r: Row): Preset => ({ ...r, modifier_ids: JSON.parse(r.modifier_ids) as string[] });

export const GET = handle(async () => {
  const user = await authed();
  const rows = await query<Row>(
    "SELECT id,name,free_text,ref_file,modifier_ids,is_public,created_at FROM presets WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
    [user.id],
  );
  return Response.json({ presets: rows.map(parse) });
});

const fields = z.object({
  name: z.string().trim().min(1).max(60),
  freeText: z.string().trim().max(1000).optional(),
  modifierIds: z.array(z.string()).max(60),
});

// multipart: name, freeText, modifierIds (JSON) e "image" opcional (portada).
export const POST = handle(async (req: Request) => {
  const user = await authed();
  const form = await req.formData();

  // "Guardar como preset" desde un resultado: toma sus modificadores, su texto extra y usa la imagen del resultado como portada.
  const generationId = form.get("generationId");
  if (typeof generationId === "string" && generationId) {
    const name = z.string().trim().min(1).max(60).parse(form.get("name"));
    const g = await one<{ free_text: string | null; result_file: string | null; kind: string }>(
      "SELECT free_text,result_file,kind FROM generations WHERE id=? AND user_id=?",
      [generationId, user.id],
    );
    if (!g) throw new HttpError(404, "Resultado no encontrado");
    const mods = await query<{ modifier_id: string }>(
      "SELECT gm.modifier_id FROM generation_modifiers gm JOIN modifiers m ON m.id=gm.modifier_id WHERE gm.generation_id=? AND m.user_id=?",
      [generationId, user.id],
    );
    if (!mods.length && !g.free_text) throw new HttpError(400, "Este resultado no tiene modificadores ni texto");
    // Copia la imagen: el preset sigue vivo aunque se borre el resultado.
    let cover: string | null = null;
    if (g.result_file && g.kind === "image") {
      try {
        cover = await saveFile(user.id, await readStored(g.result_file), g.result_file.endsWith(".png") ? "png" : "jpg");
      } catch {
        cover = null;
      }
    }
    const preset: Preset = {
      id: uid(),
      name,
      free_text: g.free_text || null,
      ref_file: cover,
      modifier_ids: mods.map((m) => m.modifier_id),
      is_public: 0,
      created_at: Date.now(),
    };
    await run("INSERT INTO presets(id,user_id,name,free_text,ref_file,modifier_ids,created_at) VALUES(?,?,?,?,?,?,?)", [
      preset.id,
      user.id,
      preset.name,
      preset.free_text,
      preset.ref_file,
      JSON.stringify(preset.modifier_ids),
      preset.created_at,
    ]);
    return Response.json({ preset });
  }

  let ids: unknown = [];
  try {
    ids = JSON.parse(String(form.get("modifierIds") ?? "[]"));
  } catch {
    throw new HttpError(400, "Modificadores inválidos");
  }
  const data = fields.parse({ name: form.get("name"), freeText: form.get("freeText") ?? undefined, modifierIds: ids });
  if (!data.modifierIds.length && !data.freeText) throw new HttpError(400, "Elige al menos un modificador o escribe un texto");

  // Solo modificadores propios.
  const own = await query<{ id: string }>(
    `SELECT id FROM modifiers WHERE user_id=? AND id IN (${data.modifierIds.map(() => "?").join(",") || "''"})`,
    [user.id, ...data.modifierIds],
  );
  const valid = data.modifierIds.filter((id) => own.some((o) => o.id === id));

  let refFile: string | null = null;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith("image/")) throw new HttpError(400, "La portada debe ser una imagen");
    if (image.size > 6 * 1024 * 1024) throw new HttpError(413, "La imagen es muy pesada");
    refFile = await saveFile(user.id, Buffer.from(await image.arrayBuffer()), image.type === "image/png" ? "png" : "jpg");
  }
  const preset: Preset = {
    id: uid(),
    name: data.name,
    free_text: data.freeText || null,
    ref_file: refFile,
    modifier_ids: valid,
    is_public: 0,
    created_at: Date.now(),
  };
  await run("INSERT INTO presets(id,user_id,name,free_text,ref_file,modifier_ids,created_at) VALUES(?,?,?,?,?,?,?)", [
    preset.id,
    user.id,
    preset.name,
    preset.free_text,
    preset.ref_file,
    JSON.stringify(valid),
    preset.created_at,
  ]);
  return Response.json({ preset });
});
