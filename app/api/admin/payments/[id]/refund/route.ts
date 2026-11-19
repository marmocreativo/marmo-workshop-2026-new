import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { applyRefund, type Payment } from "@/lib/billing";
import { one, run } from "@/lib/db";
import { STRIPE_APP_TAG, paymentIntentForInvoice, stripe } from "@/lib/stripe";

const schema = z.object({ amountCents: z.number().int().min(1).optional() });

// Reembolsa un pago en Stripe (total o parcial) y revoca los tokens proporcionales del usuario.
// El webhook charge.refunded converge al mismo resultado sin duplicar (applyRefund es idempotente).
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await adminAuthed();
  const { id } = await params;
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new HttpError(400, "Monto inválido");
  const payment = await one<Payment>("SELECT * FROM payments WHERE id=?", [id]);
  if (!payment) throw new HttpError(404, "Pago no encontrado");
  const remaining = payment.amount_cents - payment.refunded_cents;
  if (remaining <= 0) throw new HttpError(409, "Este pago ya fue reembolsado por completo");
  const amount = body.data.amountCents ?? remaining;
  if (amount > remaining) throw new HttpError(400, "El monto excede lo que queda por reembolsar");

  const s = stripe();
  let pi = payment.payment_intent;
  if (!pi && payment.kind === "plan" && payment.stripe_ref) {
    pi = await paymentIntentForInvoice(payment.stripe_ref);
    if (pi) await run("UPDATE payments SET payment_intent=? WHERE id=?", [pi, payment.id]);
  }
  if (!pi) throw new HttpError(409, "No se encontró el cobro en Stripe. Reembolsa desde el panel de Stripe.");

  await s.refunds.create(
    { payment_intent: pi, amount, metadata: { app: STRIPE_APP_TAG, payment_id: payment.id, admin_id: admin.id } },
    { idempotencyKey: `refund-${payment.id}-${payment.refunded_cents}-${amount}` },
  );
  const updated = await applyRefund(payment.id, payment.refunded_cents + amount, admin.id);
  return Response.json({ payment: updated });
});
