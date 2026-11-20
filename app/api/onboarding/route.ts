import { authed, handle } from "@/lib/api";
import { run } from "@/lib/db";

// Marca el tutorial como visto (o saltado) para no volver a mostrarlo.
export const POST = handle(async () => {
  const user = await authed();
  await run("UPDATE users SET onboarded=1 WHERE id=?", [user.id]);
  return Response.json({ ok: true });
});
