import { HttpError, authed, handle } from "@/lib/api";
import { appUrl, stripe } from "@/lib/stripe";

export const POST = handle(async () => {
  const user = await authed();
  if (!user.stripe_customer_id) throw new HttpError(400, "Aún no tienes una suscripción");
  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl()}/cuenta`,
  });
  return Response.json({ url: session.url });
});
