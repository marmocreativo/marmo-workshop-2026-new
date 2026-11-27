import { hasActiveSubscription, type User } from "./auth";
import { applyDelta } from "./billing";
import { one } from "./db";
import type { TokenPricing } from "./tokens";

/** Tier gratuito: sin suscripción activa y sin ninguna compra vigente (quien compró un pack ya pagó). */
export async function isFreeUser(user: Pick<User, "id" | "sub_status">) {
  if (hasActiveSubscription(user)) return false;
  const paid = await one("SELECT 1 FROM payments WHERE user_id=? AND status!='refunded' LIMIT 1", [user.id]);
  return !paid;
}

/** Día calendario en la Ciudad de México (la regeneración ocurre a medianoche local). */
const todayMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

/**
 * Regeneración diaria del tier gratuito: rellena el saldo hasta `dailyFreeTokens` una vez al día (no acumula).
 * Es perezosa (se aplica al consultar el saldo o al generar) e idempotente por usuario y día (ref única en el libro).
 * Devuelve el saldo actualizado.
 */
export async function applyDailyFree(user: Pick<User, "id" | "sub_status" | "tokens">, pricing: TokenPricing, free?: boolean) {
  const target = pricing.dailyFreeTokens;
  if (!target || user.tokens >= target) return user.tokens;
  if (!(free ?? (await isFreeUser(user)))) return user.tokens;
  const r = await applyDelta(user.id, target - user.tokens, "daily_free", {
    ref: `${user.id}:${todayMx()}`,
    note: "Tokens gratis del día",
  });
  return r.balance;
}
