import { HttpError, authed, handle } from "@/lib/api";
import { one, run, uid } from "@/lib/db";
import { decodeDataUrl, presetFileSchema } from "@/lib/preset-file";
import { generatePresetCover } from "@/lib/preset-cover";
import { saveFile } from "@/lib/storage";

export const maxDuration = 300;

const MAX_BYTES = 60 * 1024 * 1024; // archivo completo
const MAX_IMAGE = 8 * 1024 * 1024; // cada imagen

// Importa un archivo JSON de presets: crea las categorías y modificadores que falten y agrega los presets (no reemplaza nada).
export const POST = handle(async (req: Request) => {
  const user = await authed();
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) throw new HttpError(413, "El archivo es muy pesado (máximo 60 MB)");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "El archivo no es un JSON válido");
  }
  const parsed = presetFileSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, `Archivo de presets no válido: ${parsed.error.issues[0]?.message ?? "formato desconocido"}`);

  const catCache = new Map<string, string>();
  async function categoryId(slug: string, name: string) {
    const hit = catCache.get(slug);
    if (hit) return hit;
    const found = await one<{ id: string }>("SELECT id FROM categories WHERE user_id=? AND (slug=? OR name=?)", [user.id, slug, name]);
    let id = found?.id;
    if (!id) {
      const max = await one<{ m: number | null }>("SELECT MAX(sort) AS m FROM categories WHERE user_id=?", [user.id]);
      id = uid();
      await run("INSERT INTO categories(id,user_id,slug,name,sort) VALUES(?,?,?,?,?)", [id, user.id, slug, name, (max?.m ?? -1) + 1]);
    }
    catCache.set(slug, id);
    return id;
  }
  async function image(url: string) {
    const { buf, ext } = decodeDataUrl(url);
    if (buf.length > MAX_IMAGE) throw new HttpError(413, "Una imagen del archivo es muy pesada");
    return saveFile(user.id, buf, ext);
  }

  // Portadas faltantes: se generan con IA en paralelo (de 6 en 6) antes de guardar.
  const covers = new Map<number, string>();
  const missing = parsed.data.presets.map((p, i) => ({ p, i })).filter(({ p }) => !p.cover);
  let generated = 0;
  for (let k = 0; k < missing.length; k += 6) {
    await Promise.all(
      missing.slice(k, k + 6).map(async ({ p, i }) => {
        const img = await generatePresetCover(p);
        if (img) {
          covers.set(i, await saveFile(user.id, img.buf, img.ext));
          generated++;
        }
      }),
    );
  }

  let imported = 0;
  for (const [idx, p] of parsed.data.presets.entries()) {
    const ids: string[] = [];
    for (const m of p.modifiers) {
      const cat = await categoryId(m.category, m.category_name);
      const dup = await one<{ id: string }>("SELECT id FROM modifiers WHERE user_id=? AND category_id=? AND text=? AND archived=0", [user.id, cat, m.text]);
      if (dup) ids.push(dup.id);
      else {
        const id = uid();
        await run("INSERT INTO modifiers(id,user_id,category_id,text,created_at) VALUES(?,?,?,?,?)", [id, user.id, cat, m.text, Date.now()]);
        ids.push(id);
      }
    }
    if (!ids.length && !p.free_text?.trim()) continue; // preset vacío: se omite
    const cover = p.cover ? await image(p.cover) : (covers.get(idx) ?? null);
    const mats: string[] = [];
    const roles: Record<string, string[]> = {};
    for (const m of p.materials) {
      const f = await image(m.image);
      mats.push(f);
      if (m.roles.length) roles[f] = m.roles;
    }
    await run(
      `INSERT INTO presets(id,user_id,name,free_text,instructions,materials,material_roles,ref_file,modifier_ids,mode,favorite,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        user.id,
        p.name,
        p.free_text?.trim() || null,
        p.instructions?.trim() || null,
        mats.length ? JSON.stringify(mats) : null,
        Object.keys(roles).length ? JSON.stringify(roles) : null,
        cover,
        JSON.stringify(ids),
        p.mode,
        +p.favorite,
        Date.now() + imported, // conserva el orden del archivo
      ],
    );
    imported++;
  }
  return Response.json({ imported, skipped: parsed.data.presets.length - imported, coversGenerated: generated });
});
