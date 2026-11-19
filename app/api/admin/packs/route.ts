import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { ensureBillingSeed } from "@/lib/billing";
import { one, run } from "@/lib/db";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  tokens: z.number().int().min(1).max(1_000_000),
  priceCents: z.number().int().min(1000).max(100_000_00),
  active: z.boolean(),
  sort: z.number().int().min(0).max(99).default(0),
});

// Crea o actualiza un paquete de tokens de pago único.
export const PUT = handle(async (req: Request) => {
  await adminAuthed();
  await ensureBillingSeed();
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Revisa los datos del paquete (precio mínimo MXN 10, tokens ≥ 1)");
  const d = p.data;
  const id = d.id ?? `pack-${d.tokens}-${Date.now().toString(36)}`;
  if (d.id && (await one("SELECT id FROM token_packs WHERE id=?", [id]))) {
    await run("UPDATE token_packs SET name=?,tokens=?,price_cents=?,active=?,sort=? WHERE id=?", [
      d.name,
      d.tokens,
      d.priceCents,
      +d.active,
      d.sort,
      id,
    ]);
  } else {
    await run("INSERT INTO token_packs(id,name,tokens,price_cents,active,sort) VALUES(?,?,?,?,?,?)", [
      id,
      d.name,
      d.tokens,
      d.priceCents,
      +d.active,
      d.sort,
    ]);
  }
  return Response.json({ id });
});
