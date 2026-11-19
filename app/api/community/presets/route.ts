import { authed, handle } from "@/lib/api";
import { query } from "@/lib/db";
import type { CommunityPreset } from "@/lib/types";

// Presets que otros usuarios marcaron como públicos (sin datos del autor).
export const GET = handle(async () => {
  const user = await authed();
  const rows = await query<{ id: string; name: string; free_text: string | null; ref_file: string | null; modifier_ids: string; owner: string }>(
    `SELECT id,name,free_text,ref_file,modifier_ids,user_id AS owner FROM presets
     WHERE is_public=1 AND user_id<>? ORDER BY created_at DESC LIMIT 200`,
    [user.id],
  );
  const allIds = [...new Set(rows.flatMap((r) => JSON.parse(r.modifier_ids) as string[]))];
  const mods = allIds.length
    ? await query<{ id: string; text: string; category: string }>(
        `SELECT m.id, m.text, c.name AS category FROM modifiers m JOIN categories c ON c.id=m.category_id
         WHERE m.id IN (${allIds.map(() => "?").join(",")})`,
        allIds,
      )
    : [];
  const presets: CommunityPreset[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    free_text: r.free_text,
    ref_file: r.ref_file,
    modifiers: (JSON.parse(r.modifier_ids) as string[])
      .map((id) => mods.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map(({ text, category }) => ({ text, category })),
  }));
  return Response.json({ presets });
});
