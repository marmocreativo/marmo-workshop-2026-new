"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LedgerEntry, Pack, Plan } from "@/lib/billing";
import { api, jsonBody } from "@/lib/client";
import { MODELS } from "@/lib/models";
import { formatMxn, formatTokens, tokensFor, type TokenPricing } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export type BillingMe = {
  account: {
    email: string;
    role: string;
    tokens: number;
    plan_id: string | null;
    sub_status: string | null;
    sub_period_end: number | null;
    cancel_at_period_end: number;
    has_customer: boolean;
    bypass: boolean;
  };
  plans: Plan[];
  packs: Pack[];
  pricing: TokenPricing;
  ledger: LedgerEntry[];
};

const LEDGER_LABEL: Record<string, string> = {
  plan_grant: "Renovación de plan",
  purchase: "Compra de tokens",
  usage: "Uso",
  usage_refund: "Devolución por fallo",
  refund_revoke: "Reembolso",
  admin_adjust: "Ajuste",
  signup_bonus: "Bono de bienvenida",
};

const ACTIVE = ["active", "trialing", "past_due"];

export function BillingPanel({ justPaid }: { justPaid: boolean }) {
  const [me, setMe] = useState<BillingMe | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const startTokens = useRef<number | null>(null);

  const load = useCallback(async () => {
    const r = await api<BillingMe>("/api/billing/me");
    setMe(r);
    return r;
  }, []);

  useEffect(() => {
    load().catch((e: Error) => toast.error(e.message));
  }, [load]);

  // Tras pagar, Stripe avisa por webhook: se consulta unos segundos hasta que cambie el saldo o el plan.
  useEffect(() => {
    if (!justPaid) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const r = await load().catch(() => null);
      if (startTokens.current === null && r) startTokens.current = r.account.tokens;
      else if (r && r.account.tokens !== startTokens.current) {
        toast.success("¡Pago confirmado! Tus tokens ya están disponibles.");
        clearInterval(t);
      }
      if (tries >= 10) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [justPaid, load]);

  async function go(key: string, path: string, body?: unknown) {
    setBusy(key);
    try {
      const { url } = await api<{ url: string }>(path, { method: "POST", body: body ? jsonBody(body) : undefined });
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  async function changePlan(plan: Plan) {
    if (
      !confirm(
        `Cambiarás al plan ${plan.name} (${formatMxn(plan.price_cents)}/mes). Se cobra ahora la diferencia (con crédito por el tiempo no usado del plan actual), el ciclo se reinicia hoy y recibes los ${formatTokens(plan.tokens)} tokens del nuevo plan. ¿Continuar?`,
      )
    )
      return;
    setBusy(plan.id);
    try {
      await api("/api/billing/change-plan", { method: "POST", body: jsonBody({ planId: plan.id }) });
      toast.success("Plan actualizado. Tus tokens llegan en unos segundos.");
      setTimeout(() => load().catch(() => {}), 4000);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!me) return <Skeleton className="h-96 rounded-3xl" />;
  const { account, plans, packs, pricing, ledger } = me;
  const hasSub = ACTIVE.includes(account.sub_status ?? "") && !!account.plan_id;
  const current = plans.find((p) => p.id === account.plan_id);
  const nano = MODELS[0];
  const nanoTokens = tokensFor(nano, "auto", pricing) ?? 1;

  return (
    <div className="flex flex-col gap-8">
      {account.bypass && (
        <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          Modo desarrollo: no se descuentan tokens al generar (<code>BILLING_BYPASS=true</code>).
        </p>
      )}

      {/* Saldo */}
      <section className="rounded-3xl bg-primary p-6 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm opacity-80">
          <Coins className="size-4" /> Tu saldo
        </p>
        <p className="mt-1 text-5xl font-semibold tracking-tight">{formatTokens(account.tokens)}</p>
        <p className="text-sm opacity-80">
          tokens · ≈ {Math.floor(account.tokens / nanoTokens)} imágenes con {nano.label}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {hasSub && current ? (
            <>
              <Badge variant="secondary">Plan {current.name}</Badge>
              <span className="opacity-90">
                {account.cancel_at_period_end ? "Termina" : "Se renueva"}{" "}
                {account.sub_period_end ? new Date(account.sub_period_end).toLocaleDateString("es-MX", { dateStyle: "long" }) : ""}
                {account.sub_status === "past_due" && " · pago pendiente"}
              </span>
            </>
          ) : (
            <span className="opacity-90">Sin suscripción activa</span>
          )}
        </div>
        {account.has_customer && (
          <Button
            variant="secondary"
            className="mt-4 h-10 rounded-full bg-background text-foreground hover:bg-background/90"
            disabled={busy === "portal"}
            onClick={() => go("portal", "/api/stripe/portal")}
          >
            {busy === "portal" && <Loader2 className="animate-spin" />} Administrar suscripción y facturas
          </Button>
        )}
      </section>

      {/* Planes */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Planes mensuales</h2>
          <p className="text-sm text-muted-foreground">Se renuevan solos cada mes y puedes cancelar cuando quieras. Los tokens no caducan.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const isCurrent = hasSub && p.id === account.plan_id;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col rounded-3xl border p-5",
                  p.highlighted ? "border-primary bg-primary/5" : "bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.highlighted ? <Badge>Recomendado</Badge> : null}
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {formatMxn(p.price_cents)} <span className="text-sm font-normal text-muted-foreground">/ mes</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-3 text-sm font-medium">
                  {formatTokens(p.tokens)} tokens · ≈ {Math.floor(p.tokens / nanoTokens)} imágenes
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button className="mt-5 h-11" variant="outline" disabled>
                    Plan actual
                  </Button>
                ) : hasSub ? (
                  <Button className="mt-5 h-11" variant="outline" disabled={busy === p.id} onClick={() => changePlan(p)}>
                    {busy === p.id && <Loader2 className="animate-spin" />} Cambiar a {p.name}
                  </Button>
                ) : (
                  <Button className="mt-5 h-11" disabled={busy === p.id} onClick={() => go(p.id, "/api/billing/checkout", { kind: "plan", id: p.id })}>
                    {busy === p.id && <Loader2 className="animate-spin" />} Suscribirme
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Recargas */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Recargar tokens</h2>
          <p className="text-sm text-muted-foreground">Pago único, sin suscripción. Los tokens nunca caducan.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {packs.map((p) => (
            <div key={p.id} className="flex flex-col rounded-3xl border bg-card p-4">
              <p className="text-2xl font-semibold tracking-tight">{formatTokens(p.tokens)}</p>
              <p className="text-xs text-muted-foreground">tokens</p>
              <p className="mt-3 text-lg font-medium">{formatMxn(p.price_cents)}</p>
              <Button
                variant="outline"
                className="mt-3 h-10"
                disabled={busy === p.id}
                onClick={() => go(p.id, "/api/billing/checkout", { kind: "pack", id: p.id })}
              >
                {busy === p.id && <Loader2 className="animate-spin" />} Comprar
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Costos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">¿Cuánto cuesta cada cosa?</h2>
        <ul className="divide-y rounded-3xl border bg-card text-sm">
          {MODELS.map((m) => {
            const t = tokensFor(m, "auto", pricing);
            return (
              <li key={m.id} className="flex items-center justify-between px-4 py-3">
                <span>
                  {m.label} <span className="text-xs text-muted-foreground">· {m.kind === "video" ? "video" : "imagen"}</span>
                </span>
                <span className="font-medium">{t === null ? "No disponible" : `${t} tokens`}</span>
              </li>
            );
          })}
          <li className="flex items-center justify-between px-4 py-3">
            <span>Analizar una imagen</span>
            <span className="font-medium">{pricing.analysisTokens} {pricing.analysisTokens === 1 ? "token" : "tokens"}</span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          El costo puede variar un poco según la proporción elegida en algunos modelos. Si una generación falla, tus tokens se devuelven.
        </p>
      </section>

      {/* Movimientos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Movimientos recientes</h2>
        <ul className="divide-y rounded-3xl border bg-card text-sm">
          {ledger.length === 0 && <li className="p-4 text-muted-foreground">Aún no hay movimientos.</li>}
          {ledger.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p>{LEDGER_LABEL[e.type] ?? e.type}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("es-MX")}
                  {e.note && ` · ${e.note}`}
                </p>
              </div>
              <p className={cn("shrink-0 font-semibold", e.delta > 0 && "text-emerald-500")}>
                {e.delta > 0 ? "+" : ""}
                {e.delta}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
