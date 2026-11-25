import { authed, handle } from "@/lib/api";
import { query } from "@/lib/db";
import type { Generation } from "@/lib/types";

export const GET = handle(async (req: Request) => {
  const user = await authed();
  const modifierId = new URL(req.url).searchParams.get("modifierId");
  const gens = await query<Omit<Generation, "modifiers">>(
    `SELECT g.id,g.model,g.kind,g.free_text,g.prompt,g.source_file,g.source_deleted_at,g.is_public,g.source_public,g.aspect_ratio,g.cost_usd,g.tokens_spent,g.result_file,g.status,g.error,g.preset_id,g.created_at
     FROM generations g
     WHERE g.user_id=? ${modifierId ? "AND g.id IN (SELECT generation_id FROM generation_modifiers WHERE modifier_id=?)" : ""}
     ORDER BY g.created_at DESC LIMIT 200`,
    modifierId ? [user.id, modifierId] : [user.id],
  );
  const mods = gens.length
    ? await query<{ generation_id: string; modifier_id: string; text: string }>(
        `SELECT generation_id,modifier_id,text FROM generation_modifiers WHERE generation_id IN (${gens.map(() => "?").join(",")})`,
        gens.map((g) => g.id),
      )
    : [];
  const generations: Generation[] = gens.map((g) => ({
    ...g,
    modifiers: mods.filter((m) => m.generation_id === g.id).map(({ modifier_id, text }) => ({ modifier_id, text })),
  }));
  return Response.json({ generations });
});
