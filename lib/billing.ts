import type { InValue } from "@libsql/client";
import { batch, one, query, run, uid } from "./db";
import { DEFAULT_PRICING, type TokenPricing } from "./tokens";

/** La primera generación del tutorial es gratis: cuenta con el tutorial pendiente y sin ninguna generación previa. */
export async function firstGenerationFree(user: { id: string; onboarded: number }) {
  if (user.onboarded !== 0) return false;
  const prior = await one("SELECT 1 FROM generations WHERE user_id=? AND status!='error' LIMIT 1", [user.id]);
  return !prior;
}

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  tokens: number;
  features: string[];
  highlighted: number;
  active: number;
  sort: number;
  stripe_product_id: string | null;
};
export type Pack = { id: string; name: string; tokens: number; price_cents: number; active: number; sort: number };
export type LedgerType =
  | "plan_grant"
  | "purchase"
  | "usage"
  | "usage_refund"
  | "refund_revoke"
  | "admin_adjust"
  | "signup_bonus";
export type LedgerEntry = {
  id: string;
  delta: number;
  balance_after: number;
  type: LedgerType;
  note: string | null;
  created_at: number;
};
export type Payment = {
  id: string;
  user_id: string;
  kind: "plan" | "pack";
  item_id: string | null;
  item_name: string | null;
  amount_cents: number;
  tokens: number;
  status: "paid" | "partially_refunded" | "refunded";
  refunded_cents: number;
  tokens_revoked: number;
  stripe_ref: string | null;
  payment_intent: string | null;
  created_at: number;
};

// Precios semilla (editables desde el panel). Referencia de mercado: Midjourney $10/$30, Leonardo $12/$30,
// Krea $9/$35, OpenArt $12–14/$36 USD al mes; aquí en MXN con IVA incluido.
const DEFAULT_PLANS = [
  {
    id: "basico",
    name: "Básico",
    description: "Para probar la herramienta y crear de vez en cuando.",
    price_cents: 12900,
    tokens: 300,
    features: ["300 tokens al mes", "Todos los modelos de imagen", "Biblioteca de modificadores", "Galería privada"],
    highlighted: 0,
    sort: 0,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Para uso profesional: más volumen y mejor precio por token.",
    price_cents: 44900,
    tokens: 1300,
    features: [
      "1,300 tokens al mes",
      "Todos los modelos, incluido video",
      "Mejor precio por token",
      "Comparte modificadores y resultados",
    ],
    highlighted: 1,
    sort: 1,
  },
];
const DEFAULT_PACKS = [
  { id: "pack-100", name: "100 tokens", tokens: 100, price_cents: 5900, sort: 0 },
  { id: "pack-300", name: "300 tokens", tokens: 300, price_cents: 14900, sort: 1 },
  { id: "pack-800", name: "800 tokens", tokens: 800, price_cents: 34900, sort: 2 },
  { id: "pack-2000", name: "2,000 tokens", tokens: 2000, price_cents: 79900, sort: 3 },
];

const g = globalThis as unknown as { __billingSeed?: Promise<void> };

// Inserta planes, packs y ajustes iniciales solo si las tablas están vacías.
export function ensureBillingSeed() {
  return (g.__billingSeed ??= (async () => {
    const plans = await one<{ n: number }>("SELECT COUNT(*) AS n FROM plans");
    if (!plans?.n)
      await batch(
        DEFAULT_PLANS.map((p) => ({
          sql: "INSERT INTO plans(id,name,description,price_cents,tokens,features,highlighted,sort) VALUES(?,?,?,?,?,?,?,?)",
          args: [p.id, p.name, p.description, p.price_cents, p.tokens, JSON.stringify(p.features), p.highlighted, p.sort],
        })),
      );
    const packs = await one<{ n: number }>("SELECT COUNT(*) AS n FROM token_packs");
    if (!packs?.n)
      await batch(
        DEFAULT_PACKS.map((p) => ({
          sql: "INSERT INTO token_packs(id,name,tokens,price_cents,sort) VALUES(?,?,?,?,?)",
          args: [p.id, p.name, p.tokens, p.price_cents, p.sort],
        })),
      );
  })().catch((e) => {
    g.__billingSeed = undefined;
    throw e;
  }));
}

const parsePlan = (r: Omit<Plan, "features"> & { features: string }): Plan => ({
  ...r,
  features: (() => {
    try {
      return JSON.parse(r.features) as string[];
    } catch {
      return [];
    }
  })(),
});

export async function listPlans(opts: { all?: boolean } = {}) {
  await ensureBillingSeed();
  const rows = await query<Omit<Plan, "features"> & { features: string }>(
    `SELECT * FROM plans ${opts.all ? "" : "WHERE active=1"} ORDER BY sort, price_cents`,
  );
  return rows.map(parsePlan);
}

export async function getPlan(id: string) {
  await ensureBillingSeed();
  const r = await one<Omit<Plan, "features"> & { features: string }>("SELECT * FROM plans WHERE id=?", [id]);
  return r ? parsePlan(r) : null;
}

export async function listPacks(opts: { all?: boolean } = {}) {
  await ensureBillingSeed();
  return query<Pack>(`SELECT * FROM token_packs ${opts.all ? "" : "WHERE active=1"} ORDER BY sort, price_cents`);
}

export async function getPack(id: string) {
  await ensureBillingSeed();
  return one<Pack>("SELECT * FROM token_packs WHERE id=?", [id]);
}

export async function getPricing(): Promise<TokenPricing> {
  const settings = await query<{ key: string; value: string }>("SELECT key,value FROM settings");
  const s = Object.fromEntries(settings.map((r) => [r.key, Number(r.value)]));
  const overrides = await query<{ model_id: string; tokens_override: number | null; enabled: number }>(
    "SELECT * FROM model_tokens",
  );
  // Los factores que dividen o multiplican no pueden ser 0 ni negativos; los conteos de tokens sí pueden ser 0.
  const positive = (k: string, fallback: number) => (Number.isFinite(s[k]) && s[k] > 0 ? s[k] : fallback);
  const count = (k: string, fallback: number) => (Number.isFinite(s[k]) && s[k] >= 0 ? Math.round(s[k]) : fallback);
  return {
    usdMxn: positive("usdMxn", DEFAULT_PRICING.usdMxn),
    margin: positive("margin", DEFAULT_PRICING.margin),
    mxnPerToken: positive("mxnPerToken", DEFAULT_PRICING.mxnPerToken),
    analysisTokens: count("analysisTokens", DEFAULT_PRICING.analysisTokens),
    signupBonusTokens: count("signupBonusTokens", DEFAULT_PRICING.signupBonusTokens),
    overrides: Object.fromEntries(
      overrides.map((o) => [o.model_id, { tokens: o.tokens_override, enabled: o.enabled === 1 }]),
    ),
  };
}

const isUniqueError = (e: unknown) => /UNIQUE|constraint/i.test(String((e as Error)?.message ?? e));

type DeltaOpts = { note?: string; ref?: string; actorId?: string; clamp?: boolean };

/**
 * Suma o resta tokens y deja el movimiento en el libro (token_ledger), en una sola transacción.
 * - Con `ref`, la operación es idempotente por (tipo, ref): repetirla no vuelve a abonar (webhooks de Stripe).
 * - Con `clamp`, un descuento nunca deja el saldo en negativo.
 */
export async function applyDelta(userId: string, delta: number, type: LedgerType, opts: DeltaOpts = {}) {
  const user = await one<{ tokens: number }>("SELECT tokens FROM users WHERE id=?", [userId]);
  if (!user) throw new Error("Usuario no encontrado");
  const actual = opts.clamp ? Math.max(delta, -user.tokens) : delta;
  if (actual === 0) return { applied: 0, duplicate: false, balance: user.tokens };
  try {
    await batch([
      {
        sql: `INSERT INTO token_ledger(id,user_id,delta,balance_after,type,note,ref,actor_id,created_at)
              VALUES(?,?,?,(SELECT tokens FROM users WHERE id=?)+?,?,?,?,?,?)`,
        args: [uid(), userId, actual, userId, actual, type, opts.note ?? null, opts.ref ?? null, opts.actorId ?? null, Date.now()],
      },
      { sql: "UPDATE users SET tokens=tokens+? WHERE id=?", args: [actual, userId] },
    ]);
  } catch (e) {
    if (opts.ref && isUniqueError(e)) return { applied: 0, duplicate: true, balance: user.tokens };
    throw e;
  }
  const after = await one<{ tokens: number }>("SELECT tokens FROM users WHERE id=?", [userId]);
  return { applied: actual, duplicate: false, balance: after?.tokens ?? user.tokens + actual };
}

/** Cobra tokens de forma atómica: falla (ok=false) si el saldo no alcanza. */
export async function spendTokens(userId: string, amount: number, note: string, ref?: string) {
  if (amount <= 0) return { ok: true as const, balance: (await one<{ tokens: number }>("SELECT tokens FROM users WHERE id=?", [userId]))?.tokens ?? 0 };
  // Una sola transacción: el descuento condicional y su registro (solo si el descuento ocurrió, changes() > 0).
  const [res] = await batch([
    { sql: "UPDATE users SET tokens=tokens-? WHERE id=? AND tokens>=?", args: [amount, userId, amount] },
    {
      sql: `INSERT INTO token_ledger(id,user_id,delta,balance_after,type,note,ref,created_at)
            SELECT ?,?,?,(SELECT tokens FROM users WHERE id=?),'usage',?,?,? WHERE changes() > 0`,
      args: [uid(), userId, -amount, userId, note, ref ?? null, Date.now()],
    },
  ]);
  const row = await one<{ tokens: number }>("SELECT tokens FROM users WHERE id=?", [userId]);
  return { ok: !!res.rowsAffected, balance: row?.tokens ?? 0 };
}

export const refundUsage = (userId: string, amount: number, note: string, ref: string) =>
  amount > 0 ? applyDelta(userId, amount, "usage_refund", { note, ref }) : Promise.resolve(null);

export async function recentLedger(userId: string, limit = 30) {
  return query<LedgerEntry>(
    "SELECT id,delta,balance_after,type,note,created_at FROM token_ledger WHERE user_id=? ORDER BY created_at DESC, rowid DESC LIMIT ?",
    [userId, limit],
  );
}

/**
 * Refleja un reembolso (total acumulado en centavos) en el pago y revoca los tokens proporcionales.
 * Idempotente: solo actúa sobre la diferencia con lo ya reembolsado (webhook y acción de admin convergen).
 */
export async function applyRefund(paymentId: string, refundedTotalCents: number, actorId?: string) {
  const p = await one<Payment>("SELECT * FROM payments WHERE id=?", [paymentId]);
  if (!p) return null;
  const total = Math.min(Math.max(refundedTotalCents, 0), p.amount_cents);
  if (total <= p.refunded_cents) return p;
  const status = total >= p.amount_cents ? "refunded" : "partially_refunded";
  const shouldRevoke = Math.round((p.tokens * total) / p.amount_cents);
  const toRevoke = Math.max(shouldRevoke - p.tokens_revoked, 0);
  const res = await applyDelta(p.user_id, -toRevoke, "refund_revoke", {
    note: `Reembolso ${p.item_name ?? p.kind}`,
    ref: `${p.id}:${total}`,
    actorId,
    clamp: true,
  });
  await run("UPDATE payments SET refunded_cents=?, status=?, tokens_revoked=tokens_revoked+? WHERE id=?", [
    total,
    status,
    Math.abs(res.applied),
    p.id,
  ]);
  return one<Payment>("SELECT * FROM payments WHERE id=?", [p.id]);
}

export async function recordPayment(p: Omit<Payment, "id" | "status" | "refunded_cents" | "tokens_revoked" | "created_at">) {
  const args: InValue[] = [uid(), p.user_id, p.kind, p.item_id, p.item_name, p.amount_cents, p.tokens, "paid", p.stripe_ref, p.payment_intent, Date.now()];
  try {
    await run(
      `INSERT INTO payments(id,user_id,kind,item_id,item_name,amount_cents,tokens,status,stripe_ref,payment_intent,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      args,
    );
  } catch (e) {
    if (!isUniqueError(e)) throw e;
  }
}
