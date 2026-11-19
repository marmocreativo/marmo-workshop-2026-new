import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { run } from "@/lib/db";
import { getModel } from "@/lib/models";

const schema = z.object({
  tokensOverride: z.number().int().min(1).max(100000).nullable(), // null = calcular desde el costo del modelo
  enabled: z.boolean(),
});

export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await adminAuthed();
  const { id } = await params;
  if (!getModel(id)) throw new HttpError(404, "Modelo no encontrado");
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Datos inválidos");
  await run(
    `INSERT INTO model_tokens(model_id,tokens_override,enabled) VALUES(?,?,?)
     ON CONFLICT(model_id) DO UPDATE SET tokens_override=excluded.tokens_override, enabled=excluded.enabled`,
    [id, p.data.tokensOverride, +p.data.enabled],
  );
  return Response.json({ ok: true });
});
