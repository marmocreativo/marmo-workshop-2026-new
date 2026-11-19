import { authed, handle } from "@/lib/api";
import { getPricing, listPacks, listPlans, recentLedger } from "@/lib/billing";

// Saldo, plan actual, planes/packs disponibles y precios de tokens (todo lo que necesita la UI).
export const GET = handle(async () => {
  const user = await authed();
  const [plans, packs, pricing, ledger] = await Promise.all([
    listPlans(),
    listPacks(),
    getPricing(),
    recentLedger(user.id, 30),
  ]);
  return Response.json({
    account: {
      email: user.email,
      role: user.role,
      tokens: user.tokens,
      plan_id: user.plan_id,
      sub_status: user.sub_status,
      sub_period_end: user.sub_period_end,
      cancel_at_period_end: user.cancel_at_period_end,
      has_customer: !!user.stripe_customer_id,
      bypass: process.env.BILLING_BYPASS === "true",
    },
    plans,
    packs,
    pricing,
    ledger,
  });
});
