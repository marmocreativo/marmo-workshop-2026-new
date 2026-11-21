import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { batch, one, run, uid } from "@/lib/db";
import type { Modifier } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  favorite: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  text: z.string().trim().min(1).max(2000).optional(),
  categoryId: z.string().optional(),
  keepOriginal: z.boolean().optional(), // editar sin archivar el original (se usa desde el Studio)
});

async function owned(id: string, userId: string) {
  const m = await one<Modifier>("SELECT * FROM modifiers WHERE id=? AND user_id=?", [id, userId]);
  if (!m) throw new HttpError(404, "Modificador no encontrado");
  return m;
}

// - { favorite }: alterna favorito en el mismo registro.
// - { text, categoryId? }: editar crea un registro NUEVO (parent_id = original) y archiva el original,
//   así el historial de resultados del original se conserva intacto.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await authed();
  const { id } = await params;
  const body = schema.safeParse(await req.json());
  if (!body.success) throw new HttpError(400, "Datos inválidos");
  const current = await owned(id, user.id);

  if (body.data.text !== undefined) {
    const categoryId = body.data.categoryId ?? current.category_id;
    if (!(await one("SELECT id FROM categories WHERE id=? AND user_id=?", [categoryId, user.id])))
      throw new HttpError(400, "Categoría inválida");
    const fresh: Modifier = {
      id: uid(),
      category_id: categoryId,
      text: body.data.text,
      favorite: current.favorite,
      usage_count: 0,
      parent_id: current.id,
      archived: 0,
      is_public: 0, // la versión editada nace privada
      origin_file: current.origin_file, // conserva la imagen de la que salió
      created_at: Date.now(),
      thumbs: [],
    };
    await batch([
      ...(body.data.keepOriginal ? [] : [{ sql: "UPDATE modifiers SET archived=1 WHERE id=?", args: [current.id] }]),
      {
        sql: "INSERT INTO modifiers(id,user_id,category_id,text,favorite,parent_id,origin_file,created_at) VALUES(?,?,?,?,?,?,?,?)",
        args: [
          fresh.id,
          user.id,
          fresh.category_id,
          fresh.text,
          fresh.favorite,
          current.id,
          fresh.origin_file,
          fresh.created_at,
        ],
      },
    ]);
    return Response.json({ modifier: fresh, replaced: current.id });
  }

  if (body.data.isPublic !== undefined) {
    await run("UPDATE modifiers SET is_public=? WHERE id=?", [body.data.isPublic ? 1 : 0, id]);
    return Response.json({ modifier: { ...current, user_id: undefined, is_public: body.data.isPublic ? 1 : 0 } });
  }

  if (body.data.favorite !== undefined) {
    await run("UPDATE modifiers SET favorite=? WHERE id=?", [body.data.favorite ? 1 : 0, id]);
    return Response.json({ modifier: { ...current, favorite: body.data.favorite ? 1 : 0 } });
  }
  throw new HttpError(400, "Nada que actualizar");
});

// "Eliminar" archiva: los resultados ya generados siguen mostrando el modificador usado.
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await authed();
  const { id } = await params;
  await owned(id, user.id);
  await run("UPDATE modifiers SET archived=1 WHERE id=?", [id]);
  return Response.json({ ok: true });
});
