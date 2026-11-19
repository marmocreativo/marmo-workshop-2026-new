import { HttpError, authed, handle } from "@/lib/api";
import { one, run, uid } from "@/lib/db";

// Copia un modificador público de otro usuario a la biblioteca propia (en la categoría equivalente).
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const src = await one<{ text: string; slug: string; name: string }>(
    `SELECT m.text, c.slug, c.name FROM modifiers m JOIN categories c ON c.id=m.category_id
     WHERE m.id=? AND m.is_public=1 AND m.archived=0`,
    [id],
  );
  if (!src) throw new HttpError(404, "Modificador no disponible");

  let cat = await one<{ id: string }>("SELECT id FROM categories WHERE user_id=? AND (slug=? OR name=?)", [
    user.id,
    src.slug,
    src.name,
  ]);
  if (!cat) {
    const max = await one<{ m: number | null }>("SELECT MAX(sort) AS m FROM categories WHERE user_id=?", [user.id]);
    cat = { id: uid() };
    await run("INSERT INTO categories(id,user_id,slug,name,sort) VALUES(?,?,?,?,?)", [
      cat.id,
      user.id,
      src.slug,
      src.name,
      (max?.m ?? -1) + 1,
    ]);
  }

  const dup = await one<{ id: string }>(
    "SELECT id FROM modifiers WHERE user_id=? AND category_id=? AND text=? AND archived=0",
    [user.id, cat.id, src.text],
  );
  if (dup) return Response.json({ id: dup.id, existed: true });

  const newId = uid();
  await run("INSERT INTO modifiers(id,user_id,category_id,text,created_at) VALUES(?,?,?,?,?)", [
    newId,
    user.id,
    cat.id,
    src.text,
    Date.now(),
  ]);
  return Response.json({ id: newId, existed: false });
});
