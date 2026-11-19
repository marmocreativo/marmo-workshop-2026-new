import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { ensureBillingSeed } from "@/lib/billing";
import { one, run } from "@/lib/db";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).optional().default(""),
  priceCents: z.number().int().min(1000).max(100_000_00), // mínimo MXN 10 (límite de Stripe ≈ MXN 10)
  tokens: z.number().int().min(1).max(1_000_000),
  features: z.array(z.string().trim().min(1).max(100)).max(12),
  highlighted: z.boolean(),
  active: z.boolean(),
  sort: z.number().int().min(0).max(99).default(0),
});

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";

// Crea o actualiza un plan. Cambiar el precio aplica a nuevas suscripciones; las existentes conservan su precio
// en Stripe y reciben los tokens vigentes del plan en cada renovación.
export const PUT = handle(async (req: Request) => {
  await adminAuthed();
  await ensureBillingSeed();
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Revisa los datos del plan (precio mínimo MXN 10, tokens ≥ 1)");
  const d = p.data;
  const id = d.id ?? slug(d.name);
  const exists = await one("SELECT id FROM plans WHERE id=?", [id]);
  if (!d.id && exists) throw new HttpError(409, "Ya existe un plan con ese nombre");
  if (exists) {
    await run(
      "UPDATE plans SET name=?,description=?,price_cents=?,tokens=?,features=?,highlighted=?,active=?,sort=? WHERE id=?",
      [d.name, d.description, d.priceCents, d.tokens, JSON.stringify(d.features), +d.highlighted, +d.active, d.sort, id],
    );
  } else {
    await run(
      "INSERT INTO plans(id,name,description,price_cents,tokens,features,highlighted,active,sort) VALUES(?,?,?,?,?,?,?,?,?)",
      [id, d.name, d.description, d.priceCents, d.tokens, JSON.stringify(d.features), +d.highlighted, +d.active, d.sort],
    );
  }
  return Response.json({ id });
});
