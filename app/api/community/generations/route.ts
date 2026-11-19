import { authed, handle } from "@/lib/api";
import { query } from "@/lib/db";
import type { Generation } from "@/lib/types";

type Row = Omit<Generation, "modifiers">;

// Resultados públicos de otros usuarios. La referencia solo se incluye si su dueño también la hizo pública.
export const GET = handle(async () => {
  const user = await authed();
  const rows = await query<Row>(
    `SELECT id,model,kind,free_text,prompt,
            CASE WHEN source_public=1 AND source_deleted_at IS NULL THEN source_file END AS source_file,
            result_file,aspect_ratio,created_at
     FROM generations
     WHERE is_public=1 AND status='done' AND result_file IS NOT NULL AND user_id<>?
     ORDER BY created_at DESC LIMIT 120`,
    [user.id],
  );
  const mods = rows.length
    ? await query<{ generation_id: string; modifier_id: string; text: string }>(
        `SELECT generation_id,modifier_id,text FROM generation_modifiers WHERE generation_id IN (${rows.map(() => "?").join(",")})`,
        rows.map((r) => r.id),
      )
    : [];
  const generations: Generation[] = rows.map((r) => ({
    ...r,
    status: "done",
    error: null,
    source_deleted_at: null,
    cost_usd: null,
    is_public: 1,
    source_public: r.source_file ? 1 : 0,
    modifiers: mods.filter((m) => m.generation_id === r.id).map(({ modifier_id, text }) => ({ modifier_id, text })),
  }));
  return Response.json({ generations });
});
