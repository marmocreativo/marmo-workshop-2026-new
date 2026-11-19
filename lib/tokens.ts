import type { ModelDef } from "./models";

export type TokenPricing = {
  /** Tipo de cambio USD→MXN con el que se convierte el costo de cada modelo. */
  usdMxn: number;
  /** Multiplicador sobre el costo (cubre comisiones, IVA, margen). */
  margin: number;
  /** Valor base de un token en pesos: tokens = costo_mxn × margen ÷ mxnPerToken. */
  mxnPerToken: number;
  analysisTokens: number;
  signupBonusTokens: number;
  overrides: Record<string, { tokens: number | null; enabled: boolean }>;
};

export const DEFAULT_PRICING: TokenPricing = {
  usdMxn: 18.5,
  margin: 1.8,
  mxnPerToken: 0.4,
  analysisTokens: 1,
  signupBonusTokens: 0,
  overrides: {},
};

/** Tokens calculados solo a partir del costo del modelo (sin override). */
export function autoTokens(model: ModelDef, ratio: string, p: TokenPricing) {
  const costMxn = model.cost(ratio).usd * p.usdMxn;
  return Math.max(1, Math.ceil((costMxn * p.margin) / p.mxnPerToken - 1e-9));
}

/** Tokens que cuesta una generación; null si el administrador deshabilitó el modelo. */
export function tokensFor(model: ModelDef, ratio: string, p: TokenPricing): number | null {
  const o = p.overrides[model.id];
  if (o && !o.enabled) return null;
  if (o?.tokens != null) return o.tokens;
  return autoTokens(model, ratio, p);
}

export const formatMxn = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  );

export const formatTokens = (n: number) => new Intl.NumberFormat("es-MX").format(n);
