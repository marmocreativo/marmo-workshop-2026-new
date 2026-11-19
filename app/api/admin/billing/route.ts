import { adminAuthed, handle } from "@/lib/api";
import { getPricing, listPacks, listPlans } from "@/lib/billing";
import { MODELS } from "@/lib/models";
import { autoTokens } from "@/lib/tokens";

// Configuración de cobro completa para el panel: planes, packs, parámetros y costo por modelo.
export const GET = handle(async () => {
  await adminAuthed();
  const [plans, packs, pricing] = await Promise.all([listPlans({ all: true }), listPacks({ all: true }), getPricing()]);
  const models = MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    kind: m.kind,
    costUsd: m.cost("auto").usd,
    costUpTo: !!m.cost("auto").upTo,
    autoTokens: autoTokens(m, "auto", pricing),
    override: pricing.overrides[m.id]?.tokens ?? null,
    enabled: pricing.overrides[m.id]?.enabled ?? true,
  }));
  return Response.json({ plans, packs, pricing: { ...pricing, overrides: undefined }, models });
});
