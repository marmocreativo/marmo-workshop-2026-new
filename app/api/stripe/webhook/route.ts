import Stripe from "stripe";
import { applyDelta, applyRefund, getPlan, recordPayment, type Payment } from "@/lib/billing";
import { one, run } from "@/lib/db";
import { STRIPE_APP_TAG, paymentIntentForInvoice } from "@/lib/stripe";

// La cuenta de Stripe se comparte con la versión anterior del proyecto: solo se procesan los objetos
// que llevan la marca de esta app en sus metadatos; el resto se ignora (responde 200).
const mine = (meta?: Stripe.Metadata | null) => meta?.app === STRIPE_APP_TAG && !!meta.user_id;
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function onCheckoutPaid(s: Stripe.Checkout.Session) {
  if (!mine(s.metadata)) return;
  const userId = s.metadata!.user_id;
  if (s.mode === "subscription") {
    // Los tokens del plan se abonan al pagarse la factura (invoice.paid), aquí solo se enlaza la suscripción.
    const subId = idOf(s.subscription);
    if (subId) await run("UPDATE users SET stripe_subscription_id=?, plan_id=? WHERE id=?", [subId, s.metadata!.plan_id ?? null, userId]);
    return;
  }
  if (s.mode !== "payment" || s.payment_status !== "paid" || s.metadata!.kind !== "pack") return;
  const tokens = Number(s.metadata!.tokens);
  if (!Number.isInteger(tokens) || tokens <= 0) return;
  await recordPayment({
    user_id: userId,
    kind: "pack",
    item_id: s.metadata!.pack_id ?? null,
    item_name: s.metadata!.item_name ?? "Paquete de tokens",
    amount_cents: s.amount_total ?? 0,
    tokens,
    stripe_ref: s.id,
    payment_intent: idOf(s.payment_intent),
  });
  await applyDelta(userId, tokens, "purchase", { ref: s.id, note: s.metadata!.item_name });
}

async function onInvoicePaid(inv: Stripe.Invoice) {
  const sd = inv.parent?.subscription_details;
  if (!sd || !mine(sd.metadata) || inv.amount_paid <= 0) return;
  const userId = sd.metadata!.user_id;
  const planId = sd.metadata!.plan_id ?? null;
  const plan = planId ? await getPlan(planId) : null;
  if (!plan) return;
  let pi: string | null = null;
  try {
    pi = await paymentIntentForInvoice(inv.id!);
  } catch {
    // Se resuelve más tarde al reembolsar (ver /api/admin/payments/[id]/refund).
  }
  await recordPayment({
    user_id: userId,
    kind: "plan",
    item_id: plan.id,
    item_name: `Plan ${plan.name}`,
    amount_cents: inv.amount_paid,
    tokens: plan.tokens,
    stripe_ref: inv.id!,
    payment_intent: pi,
  });
  await applyDelta(userId, plan.tokens, "plan_grant", { ref: inv.id!, note: `Plan ${plan.name}` });
}

async function onSubscription(sub: Stripe.Subscription) {
  if (!mine(sub.metadata)) return;
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const ended = ["canceled", "unpaid", "incomplete_expired"].includes(sub.status);
  const end = sub.items.data[0]?.current_period_end;
  await run(
    `UPDATE users SET sub_status=?, sub_period_end=?, cancel_at_period_end=?, stripe_subscription_id=?,
       plan_id=CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE plan_id END WHERE id=?`,
    [
      sub.status,
      end ? end * 1000 : null,
      sub.cancel_at_period_end ? 1 : 0,
      ended ? null : sub.id,
      active ? 1 : 0,
      sub.metadata.plan_id ?? null,
      ended ? 1 : 0,
      sub.metadata.user_id,
    ],
  );
}

async function onChargeRefunded(ch: Stripe.Charge) {
  const pi = idOf(ch.payment_intent);
  let payment = pi ? await one<Payment>("SELECT * FROM payments WHERE payment_intent=?", [pi]) : null;
  if (!payment && ch.customer) {
    // Pago de suscripción cuyo PaymentIntent no se pudo guardar al cobrarse: se enlaza por cliente y monto.
    const userRow = await one<{ id: string }>("SELECT id FROM users WHERE stripe_customer_id=?", [idOf(ch.customer)]);
    if (userRow) {
      payment = await one<Payment>(
        "SELECT * FROM payments WHERE user_id=? AND payment_intent IS NULL AND amount_cents=? ORDER BY created_at DESC LIMIT 1",
        [userRow.id, ch.amount],
      );
      if (payment && pi) await run("UPDATE payments SET payment_intent=? WHERE id=?", [pi, payment.id]);
    }
  }
  if (payment) await applyRefund(payment.id, ch.amount_refunded);
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook no configurado", { status: 400 });

  let event: Stripe.Event;
  try {
    // Verificar la firma es local (no llama a Stripe), por eso no pasa por el freno de llaves de producción.
    event = Stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Firma inválida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await onCheckoutPaid(event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscription(event.data.object);
        break;
      case "charge.refunded":
        await onChargeRefunded(event.data.object);
        break;
    }
  } catch (e) {
    console.error(e);
    return new Response("Error procesando evento", { status: 500 });
  }
  return new Response("ok");
}
