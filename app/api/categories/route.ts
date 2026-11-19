import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { syncDefaultCategories } from "@/lib/auth";
import { one, query, run, uid } from "@/lib/db";
import type { Category } from "@/lib/types";

export const GET = handle(async () => {
  const user = await authed();
  await syncDefaultCategories(user.id);
  const categories = await query<Category>(
    "SELECT id,slug,name,sort FROM categories WHERE user_id=? ORDER BY sort,name",
    [user.id],
  );
  return Response.json({ categories });
});

const schema = z.object({ name: z.string().trim().min(1).max(40) });

export const POST = handle(async (req: Request) => {
  const user = await authed();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Escribe un nombre para la categoría");
  const max = await one<{ m: number | null }>("SELECT MAX(sort) AS m FROM categories WHERE user_id=?", [user.id]);
  const category: Category = {
    id: uid(),
    slug: parsed.data.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: parsed.data.name,
    sort: (max?.m ?? 0) + 1,
  };
  await run("INSERT INTO categories(id,user_id,slug,name,sort) VALUES(?,?,?,?,?)", [
    category.id,
    user.id,
    category.slug,
    category.name,
    category.sort,
  ]);
  return Response.json({ category });
});
