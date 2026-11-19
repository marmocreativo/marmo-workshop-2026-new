import Stripe from "stripe";
import { run } from "./db";
import type { Plan } from "./billing";

// Etiqueta que llevan todos los objetos de Stripe creados por esta app. La cuenta de Stripe se comparte con
// la versión anterior del proyecto, así que los webhooks ignoran todo lo que no traiga esta marca.
export const STRIPE_APP_TAG = "marmo-workshop";

const secretKey = () => process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET;

let _stripe: Stripe | null = null;
export function stripe() {
  const key = secretKey();
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  // Freno de seguridad: con una llave de producción en local se cobraría dinero real.
  if (key.startsWith("sk_live_") && process.env.NODE_ENV !== "production" && process.env.ALLOW_LIVE_STRIPE_IN_DEV !== "true")
    throw new Error(
      "Estás usando una llave de Stripe de producción en modo local. Usa una llave sk_test_ o define ALLOW_LIVE_STRIPE_IN_DEV=true bajo tu responsabilidad.",
    );
  return (_stripe ??= new Stripe(key));
}

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** Producto de Stripe asociado a un plan (se crea la primera vez que se necesita y se guarda). */
export async function ensureStripeProduct(plan: Plan) {
  if (plan.stripe_product_id) return plan.stripe_product_id;
  const product = await stripe().products.create({
    name: `Marmo Workshop — ${plan.name}`,
    metadata: { app: STRIPE_APP_TAG, plan_id: plan.id },
  });
  await run("UPDATE plans SET stripe_product_id=? WHERE id=?", [product.id, plan.id]);
  return product.id;
}

export async function ensureStripeCustomer(user: { id: string; email: string; stripe_customer_id: string | null }) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe().customers.create({
    email: user.email,
    metadata: { app: STRIPE_APP_TAG, user_id: user.id },
  });
  await run("UPDATE users SET stripe_customer_id=? WHERE id=?", [customer.id, user.id]);
  return customer.id;
}

/** PaymentIntent de una factura (necesario para reembolsar pagos de suscripción). */
export async function paymentIntentForInvoice(invoiceId: string) {
  const list = await stripe().invoicePayments.list({ invoice: invoiceId, limit: 5 });
  for (const ip of list.data) {
    const pi = ip.payment.payment_intent;
    if (pi) return typeof pi === "string" ? pi : pi.id;
  }
  return null;
}
