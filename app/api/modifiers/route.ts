import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { one, query, run, uid } from "@/lib/db";
import type { Modifier } from "@/lib/types";

const COLS = "id,category_id,text,favorite,usage_count,parent_id,archived,is_public,origin_file,created_at";
const THUMBS_PER_MODIFIER = 4;

export const GET = handle(async () => {
  const user = await authed();
  const modifiers = await query<Modifier>(
    `SELECT ${COLS} FROM modifiers WHERE user_id=? AND archived=0 ORDER BY favorite DESC, usage_count DESC, created_at DESC`,
    [user.id],
  );
  // Miniaturas: los resultados (imagen) más recientes de cada modificador.
  const rows = await query<{ modifier_id: string; result_file: string }>(
    `SELECT modifier_id, result_file FROM (
       SELECT gm.modifier_id, g.result_file,
              ROW_NUMBER() OVER (PARTITION BY gm.modifier_id ORDER BY g.created_at DESC) AS rn
       FROM generation_modifiers gm JOIN generations g ON g.id=gm.generation_id
       WHERE g.user_id=? AND g.status='done' AND g.kind='image' AND g.result_file IS NOT NULL
     ) WHERE rn<=?`,
    [user.id, THUMBS_PER_MODIFIER],
  );
  const thumbs = new Map<string, string[]>();
  for (const r of rows) thumbs.set(r.modifier_id, [...(thumbs.get(r.modifier_id) ?? []), r.result_file]);
  return Response.json({ modifiers: modifiers.map((m) => ({ ...m, thumbs: thumbs.get(m.id) ?? [] })) });
});

const schema = z.object({
  items: z
    .array(
      z.object({
        categoryId: z.string(),
        text: z.string().trim().min(1).max(2000),
        originFile: z.string().optional(),
      }),
    )
    .min(1)
    .max(30),
});

// Crea uno o varios modificadores (varios cuando vienen del análisis de imagen).
export const POST = handle(async (req: Request) => {
  const user = await authed();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Escribe el texto del modificador (máximo 2000 caracteres)");
  const created: Modifier[] = [];
  for (const it of parsed.data.items) {
    const cat = await one("SELECT id FROM categories WHERE id=? AND user_id=?", [it.categoryId, user.id]);
    if (!cat) throw new HttpError(400, "Categoría inválida");
    if (it.originFile && !it.originFile.startsWith(`${user.id}_`)) throw new HttpError(400, "Imagen de origen inválida");
    const m: Modifier = {
      id: uid(),
      category_id: it.categoryId,
      text: it.text,
      favorite: 0,
      usage_count: 0,
      parent_id: null,
      archived: 0,
      is_public: 0,
      origin_file: it.originFile ?? null,
      created_at: Date.now(),
      thumbs: [],
    };
    await run("INSERT INTO modifiers(id,user_id,category_id,text,origin_file,created_at) VALUES(?,?,?,?,?,?)", [
      m.id,
      user.id,
      m.category_id,
      m.text,
      m.origin_file,
      m.created_at,
    ]);
    created.push(m);
  }
  return Response.json({ modifiers: created });
});
