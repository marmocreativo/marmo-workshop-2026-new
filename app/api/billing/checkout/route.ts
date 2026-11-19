import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { hasActiveSubscription } from "@/lib/auth";
import { getPack, getPlan } from "@/lib/billing";
import { STRIPE_APP_TAG, appUrl, ensureStripeCustomer, ensureStripeProduct, stripe } from "@/lib/stripe";

const schema = z.object({ kind: z.enum(["plan", "pack"]), id: z.string().min(1) });

// Crea una sesión de Checkout de Stripe en MXN: suscripción mensual (plan) o pago único (pack de tokens).
// Los montos salen de la base de datos (nunca del cliente) y los tokens se fijan en los metadatos.
export const POST = handle(async (req: Request) => {
  const user = await authed();
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) throw new HttpError(400, "Datos inválidos");
  const s = stripe();
  const customer = await ensureStripeCustomer(user);
  const base = {
    customer,
    client_reference_id: user.id,
    locale: "es-419" as const,
    success_url: `${appUrl()}/cuenta?pago=ok`,
    cancel_url: `${appUrl()}/cuenta?pago=cancelado`,
  };

  if (body.data.kind === "plan") {
    const plan = await getPlan(body.data.id);
    if (!plan || !plan.active) throw new HttpError(404, "Ese plan no está disponible");
    if (hasActiveSubscription(user)) throw new HttpError(409, "Ya tienes una suscripción activa. Usa «Cambiar plan».");
    const meta = { app: STRIPE_APP_TAG, user_id: user.id, kind: "plan", plan_id: plan.id };
    const session = await s.checkout.sessions.create({
      ...base,
      mode: "subscription",
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            product: await ensureStripeProduct(plan),
            unit_amount: plan.price_cents,
            recurring: { interval: "month" },
          },
        },
      ],
      metadata: meta,
      subscription_data: { metadata: meta },
    });
    return Response.json({ url: session.url });
  }

  const pack = await getPack(body.data.id);
  if (!pack || !pack.active) throw new HttpError(404, "Ese paquete no está disponible");
  const meta = {
    app: STRIPE_APP_TAG,
    user_id: user.id,
    kind: "pack",
    pack_id: pack.id,
    tokens: String(pack.tokens),
    item_name: pack.name,
  };
  const session = await s.checkout.sessions.create({
    ...base,
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: pack.price_cents,
          product_data: { name: `Marmo Workshop — ${pack.name}`, metadata: { app: STRIPE_APP_TAG } },
        },
      },
    ],
    metadata: meta,
    payment_intent_data: { metadata: meta },
  });
  return Response.json({ url: session.url });
});
