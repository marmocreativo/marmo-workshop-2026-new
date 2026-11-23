import { HttpError, authed, handle } from "@/lib/api";
import { one, query, run, uid } from "@/lib/db";
import { readStored, saveFile } from "@/lib/storage";

// Copia un preset público a la biblioteca propia: crea los modificadores (en las categorías equivalentes) y el preset.
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const src = await one<{ name: string; free_text: string | null; instructions: string | null; materials: string | null; ref_file: string | null; modifier_ids: string }>(
    "SELECT name,free_text,instructions,materials,ref_file,modifier_ids FROM presets WHERE id=? AND is_public=1 AND user_id<>?",
    [id, user.id],
  );
  if (!src) throw new HttpError(404, "Preset no disponible");

  const ids = JSON.parse(src.modifier_ids) as string[];
  const mods = ids.length
    ? await query<{ id: string; text: string; slug: string; name: string }>(
        `SELECT m.id, m.text, c.slug, c.name FROM modifiers m JOIN categories c ON c.id=m.category_id
         WHERE m.archived=0 AND m.id IN (${ids.map(() => "?").join(",")})`,
        ids,
      )
    : [];

  const catCache = new Map<string, string>();
  const newIds: string[] = [];
  for (const m of mods) {
    let catId = catCache.get(m.slug);
    if (!catId) {
      const found = await one<{ id: string }>("SELECT id FROM categories WHERE user_id=? AND (slug=? OR name=?)", [user.id, m.slug, m.name]);
      if (found) catId = found.id;
      else {
        const max = await one<{ m: number | null }>("SELECT MAX(sort) AS m FROM categories WHERE user_id=?", [user.id]);
        catId = uid();
        await run("INSERT INTO categories(id,user_id,slug,name,sort) VALUES(?,?,?,?,?)", [catId, user.id, m.slug, m.name, (max?.m ?? -1) + 1]);
      }
      catCache.set(m.slug, catId);
    }
    const dup = await one<{ id: string }>("SELECT id FROM modifiers WHERE user_id=? AND category_id=? AND text=? AND archived=0", [user.id, catId, m.text]);
    if (dup) {
      newIds.push(dup.id);
      continue;
    }
    const nid = uid();
    await run("INSERT INTO modifiers(id,user_id,category_id,text,created_at) VALUES(?,?,?,?,?)", [nid, user.id, catId, m.text, Date.now()]);
    newIds.push(nid);
  }

  let cover: string | null = null;
  if (src.ref_file) {
    try {
      cover = await saveFile(user.id, await readStored(src.ref_file), src.ref_file.endsWith(".png") ? "png" : "jpg");
    } catch {
      cover = null;
    }
  }
  const mats: string[] = [];
  for (const f of src.materials ? (JSON.parse(src.materials) as string[]) : []) {
    try {
      mats.push(await saveFile(user.id, await readStored(f), f.endsWith(".png") ? "png" : "jpg"));
    } catch {}
  }
  const presetId = uid();
  await run("INSERT INTO presets(id,user_id,name,free_text,instructions,materials,ref_file,modifier_ids,is_public,created_at) VALUES(?,?,?,?,?,?,?,?,0,?)", [
    presetId,
    user.id,
    src.name,
    src.free_text,
    src.instructions,
    mats.length ? JSON.stringify(mats) : null,
    cover,
    JSON.stringify(newIds),
    Date.now(),
  ]);
  return Response.json({ id: presetId });
});
