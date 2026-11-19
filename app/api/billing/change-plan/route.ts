import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { hasActiveSubscription } from "@/lib/auth";
import { getPlan } from "@/lib/billing";
import { run } from "@/lib/db";
import { STRIPE_APP_TAG, ensureStripeProduct, stripe } from "@/lib/stripe";

const schema = z.object({ planId: z.string().min(1) });

// Cambia el plan de una suscripción existente: cobra el nuevo plan de inmediato (con crédito prorrateado por
// el tiempo no usado del anterior) y reinicia el ciclo. Los tokens del nuevo plan se abonan al cobrarse la factura.
export const POST = handle(async (req: Request) => {
  const user = await authed();
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) throw new HttpError(400, "Datos inválidos");
  if (!user.stripe_subscription_id || !hasActiveSubscription(user)) throw new HttpError(409, "No tienes una suscripción activa");
  const plan = await getPlan(body.data.planId);
  if (!plan || !plan.active) throw new HttpError(404, "Ese plan no está disponible");
  if (plan.id === user.plan_id) throw new HttpError(400, "Ya estás en ese plan");

  const s = stripe();
  const sub = await s.subscriptions.retrieve(user.stripe_subscription_id);
  const item = sub.items.data[0];
  if (!item) throw new HttpError(409, "La suscripción no tiene un plan asociado");

  await s.subscriptions.update(sub.id, {
    items: [
      {
        id: item.id,
        price_data: {
          currency: "mxn",
          product: await ensureStripeProduct(plan),
          unit_amount: plan.price_cents,
          recurring: { interval: "month" },
        },
      },
    ],
    proration_behavior: "create_prorations",
    billing_cycle_anchor: { type: "now" },
    payment_behavior: "error_if_incomplete",
    cancel_at_period_end: false,
    metadata: { app: STRIPE_APP_TAG, user_id: user.id, plan_id: plan.id },
  });
  await run("UPDATE users SET plan_id=?, cancel_at_period_end=0 WHERE id=?", [plan.id, user.id]);
  return Response.json({ ok: true });
});
