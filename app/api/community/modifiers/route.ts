import { authed, handle } from "@/lib/api";
import { query } from "@/lib/db";
import type { CommunityModifier } from "@/lib/types";

// Modificadores que otros usuarios marcaron como públicos (sin datos del autor).
export const GET = handle(async () => {
  const user = await authed();
  const modifiers = await query<CommunityModifier>(
    `SELECT m.id, m.text, c.name AS category, m.usage_count
     FROM modifiers m JOIN categories c ON c.id=m.category_id
     WHERE m.is_public=1 AND m.archived=0 AND m.user_id<>?
     ORDER BY m.usage_count DESC, m.created_at DESC LIMIT 300`,
    [user.id],
  );
  return Response.json({ modifiers });
});
