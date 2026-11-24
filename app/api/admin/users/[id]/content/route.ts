import { HttpError, adminAuthed, handle } from "@/lib/api";
import { one, query } from "@/lib/db";

const PAGE = 48;

// Contenido de un usuario para el administrador: generaciones, modificadores o presets (paginado).
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await adminAuthed();
  const { id } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  if (!(await one("SELECT 1 FROM users WHERE id=?", [id]))) throw new HttpError(404, "Usuario no encontrado");

  const counts = await one<{ generations: number; modifiers: number; presets: number }>(
    `SELECT (SELECT COUNT(*) FROM generations WHERE user_id=?1) AS generations,
            (SELECT COUNT(*) FROM modifiers WHERE user_id=?1 AND archived=0) AS modifiers,
            (SELECT COUNT(*) FROM presets WHERE user_id=?1) AS presets`,
    [id],
  );

  if (type === "generations") {
    const items = await query<{ id: string }>(
      `SELECT id,model,kind,status,error,free_text,prompt,source_file,result_file,aspect_ratio,tokens_spent,is_public,created_at
       FROM generations WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [id, PAGE, offset],
    );
    const mods = items.length
      ? await query<{ generation_id: string; text: string }>(
          `SELECT generation_id,text FROM generation_modifiers WHERE generation_id IN (${items.map(() => "?").join(",")})`,
          items.map((g) => g.id),
        )
      : [];
    return Response.json({
      counts,
      items: items.map((g) => ({ ...g, modifiers: mods.filter((m) => m.generation_id === g.id).map((m) => m.text) })),
      more: offset + items.length < counts!.generations,
    });
  }

  if (type === "modifiers") {
    const items = await query(
      `SELECT m.id,m.text,m.usage_count,m.favorite,m.is_public,m.origin_file,m.created_at,c.name AS category
       FROM modifiers m JOIN categories c ON c.id=m.category_id
       WHERE m.user_id=? AND m.archived=0 ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [id, PAGE, offset],
    );
    return Response.json({ counts, items, more: offset + items.length < counts!.modifiers });
  }

  if (type === "presets") {
    const items = await query<{ id: string; modifier_ids: string; materials: string | null }>(
      `SELECT id,name,free_text,instructions,materials,ref_file,modifier_ids,is_public,created_at
       FROM presets WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [id, PAGE, offset],
    );
    const all = [...new Set(items.flatMap((p) => JSON.parse(p.modifier_ids) as string[]))];
    const mods = all.length
      ? await query<{ id: string; text: string }>(`SELECT id,text FROM modifiers WHERE id IN (${all.map(() => "?").join(",")})`, all)
      : [];
    return Response.json({
      counts,
      items: items.map((p) => ({
        ...p,
        modifier_ids: undefined,
        materials: p.materials ? JSON.parse(p.materials) : [],
        modifiers: (JSON.parse(p.modifier_ids) as string[]).map((m) => mods.find((x) => x.id === m)?.text).filter(Boolean),
      })),
      more: offset + items.length < counts!.presets,
    });
  }

  return Response.json({ counts });
});
