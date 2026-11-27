"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Pack, Plan } from "@/lib/billing";
import { api, jsonBody } from "@/lib/client";
import { getModel } from "@/lib/models";
import { formatMxn, tokensFor, type TokenPricing } from "@/lib/tokens";

type ModelRow = {
  id: string;
  label: string;
  provider: string;
  kind: string;
  costUsd: number;
  costUpTo: boolean;
  autoTokens: number;
  override: number | null;
  enabled: boolean;
};
type Data = { plans: Plan[]; packs: Pack[]; pricing: Omit<TokenPricing, "overrides">; models: ModelRow[] };

const card = "rounded-3xl border bg-card p-5";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const pesos = (cents: number) => String(cents / 100);
const toCents = (v: string) => Math.round(parseFloat(v || "0") * 100);

export function PlansAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [newPlans, setNewPlans] = useState<number[]>([]);
  const [newPacks, setNewPacks] = useState<number[]>([]);

  const load = useCallback(async () => {
    setData(await api<Data>("/api/admin/billing"));
  }, []);
  useEffect(() => {
    load().catch((e: Error) => toast.error(e.message));
  }, [load]);

  if (!data) return <Skeleton className="h-96 rounded-3xl" />;
  const reload = () => load().catch((e: Error) => toast.error(e.message));

  return (
    <div className="flex flex-col gap-8 pb-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Planes y tokens</h1>
        <p className="text-sm text-muted-foreground">
          Los precios se cobran en MXN (con IVA incluido) en Stripe. Los cambios de precio aplican a nuevas compras; las
          suscripciones activas conservan su precio y reciben los tokens vigentes del plan en cada renovación.
        </p>
      </header>

      <Params pricing={data.pricing} onSaved={reload} />
      <Models models={data.models} pricing={data.pricing} onSaved={reload} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Planes de suscripción</h2>
          <Button variant="outline" size="sm" onClick={() => setNewPlans((n) => [...n, Date.now()])}>
            <Plus /> Nuevo plan
          </Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.plans.map((p) => (
            <PlanEditor key={p.id} plan={p} pricing={data.pricing} onSaved={reload} />
          ))}
          {newPlans.map((k) => (
            <PlanEditor
              key={k}
              pricing={data.pricing}
              onSaved={() => {
                setNewPlans((n) => n.filter((x) => x !== k));
                reload();
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Paquetes de tokens (recarga única)</h2>
          <Button variant="outline" size="sm" onClick={() => setNewPacks((n) => [...n, Date.now()])}>
            <Plus /> Nuevo paquete
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.packs.map((p) => (
            <PackEditor key={p.id} pack={p} onSaved={reload} />
          ))}
          {newPacks.map((k) => (
            <PackEditor
              key={k}
              onSaved={() => {
                setNewPacks((n) => n.filter((x) => x !== k));
                reload();
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Params({ pricing, onSaved }: { pricing: Data["pricing"]; onSaved: () => void }) {
  const [v, setV] = useState({
    usdMxn: String(pricing.usdMxn),
    margin: String(pricing.margin),
    mxnPerToken: String(pricing.mxnPerToken),
    analysisTokens: String(pricing.analysisTokens),
    signupBonusTokens: String(pricing.signupBonusTokens),
    dailyFreeTokens: String(pricing.dailyFreeTokens),
    freeModelMaxTokens: String(pricing.freeModelMaxTokens),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: jsonBody({
          usdMxn: parseFloat(v.usdMxn),
          margin: parseFloat(v.margin),
          mxnPerToken: parseFloat(v.mxnPerToken),
          analysisTokens: parseInt(v.analysisTokens, 10),
          signupBonusTokens: parseInt(v.signupBonusTokens, 10),
          dailyFreeTokens: parseInt(v.dailyFreeTokens, 10) || 0,
          freeModelMaxTokens: parseInt(v.freeModelMaxTokens, 10) || 0,
        }),
      });
      toast.success("Parámetros guardados");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">Cálculo de tokens</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tokens por generación = costo del modelo (USD) × tipo de cambio × margen ÷ valor base del token, redondeado hacia arriba.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Tipo de cambio USD→MXN">
          <Input type="number" step="0.01" min="1" value={v.usdMxn} onChange={set("usdMxn")} />
        </Field>
        <Field label="Margen (×)" hint="Cubre IVA, comisiones y ganancia.">
          <Input type="number" step="0.05" min="1" value={v.margin} onChange={set("margin")} />
        </Field>
        <Field label="Valor base de 1 token (MXN)">
          <Input type="number" step="0.01" min="0.01" value={v.mxnPerToken} onChange={set("mxnPerToken")} />
        </Field>
        <Field label="Tokens por análisis de imagen">
          <Input type="number" step="1" min="0" value={v.analysisTokens} onChange={set("analysisTokens")} />
        </Field>
        <Field label="Bono de bienvenida (tokens)" hint="Al registrarse. 0 = ninguno.">
          <Input type="number" step="1" min="0" value={v.signupBonusTokens} onChange={set("signupBonusTokens")} />
        </Field>
      </div>
      <h3 className="mt-6 font-semibold">Tier gratuito</h3>
      <p className="mt-1 text-sm text-muted-foreground">Usuarios sin suscripción activa y sin compras.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Tokens gratis por día" hint="Rellena el saldo hasta esta cantidad cada medianoche (CDMX). No acumula. 0 = apagado.">
          <Input type="number" step="1" min="0" value={v.dailyFreeTokens} onChange={set("dailyFreeTokens")} />
        </Field>
        <Field label="Costo máximo de modelo (tokens)" hint="Solo pueden usar modelos que cuesten hasta esto. 0 = todos.">
          <Input type="number" step="1" min="0" value={v.freeModelMaxTokens} onChange={set("freeModelMaxTokens")} />
        </Field>
      </div>
      <Button className="mt-4" disabled={busy} onClick={save}>
        {busy && <Loader2 className="animate-spin" />} Guardar parámetros
      </Button>
    </section>
  );
}

function Models({ models, pricing, onSaved }: { models: ModelRow[]; pricing: Data["pricing"]; onSaved: () => void }) {
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">Costo por modelo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        El costo en USD viene de fal.ai (proporción Auto). Puedes fijar un número de tokens a mano o dejarlo automático, y
        deshabilitar un modelo.
      </p>
      <ul className="mt-4 divide-y">
        {models.map((m) => (
          <ModelRowEditor key={m.id} m={m} pricing={pricing} onSaved={onSaved} />
        ))}
      </ul>
    </section>
  );
}

function ModelRowEditor({ m, pricing, onSaved }: { m: ModelRow; pricing: Data["pricing"]; onSaved: () => void }) {
  const [override, setOverride] = useState(m.override == null ? "" : String(m.override));
  const [enabled, setEnabled] = useState(m.enabled);
  const [busy, setBusy] = useState(false);
  const dirty = override !== (m.override == null ? "" : String(m.override)) || enabled !== m.enabled;

  async function save() {
    setBusy(true);
    try {
      await api(`/api/admin/models/${m.id}`, {
        method: "PUT",
        body: jsonBody({ tokensOverride: override === "" ? null : parseInt(override, 10), enabled }),
      });
      toast.success(`${m.label} guardado`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pending = override === "" ? m.autoTokens : parseInt(override, 10);
  void pricing;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-40 flex-1">
        <p className="font-medium">{m.label}</p>
        <p className="text-xs text-muted-foreground">
          {m.provider} · {m.kind === "video" ? "video" : "imagen"} · costo {m.costUpTo ? "hasta " : "≈ "}US${m.costUsd.toFixed(3)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Automático: <span className="font-semibold text-foreground">{m.autoTokens}</span> tokens
      </p>
      <div className="w-28">
        <Input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          placeholder={`Auto (${m.autoTokens})`}
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          aria-label={`Tokens fijos para ${m.label}`}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={enabled} onCheckedChange={setEnabled} /> Activo
      </label>
      <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || busy} onClick={save}>
        {busy ? <Loader2 className="animate-spin" /> : null} Guardar
      </Button>
      {dirty && Number.isFinite(pending) && <span className="w-full text-xs text-muted-foreground">Costará {pending} tokens por generación.</span>}
    </li>
  );
}

function PlanEditor({ plan, pricing, onSaved }: { plan?: Plan; pricing: Data["pricing"]; onSaved: () => void }) {
  const [v, setV] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? pesos(plan.price_cents) : "",
    tokens: plan ? String(plan.tokens) : "",
    features: (plan?.features ?? []).join("\n"),
    highlighted: !!plan?.highlighted,
    active: plan ? !!plan.active : true,
    sort: String(plan?.sort ?? 0),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: "name" | "description" | "price" | "tokens" | "features" | "sort") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const perToken = useMemo(() => {
    const t = parseInt(v.tokens, 10);
    const c = toCents(v.price);
    return t > 0 && c > 0 ? c / 100 / t : null;
  }, [v.tokens, v.price]);
  const nano = getModel("nano-banana")!;
  const nanoTokens = tokensFor(nano, "auto", { ...pricing, overrides: {} }) ?? 1;
  const images = parseInt(v.tokens, 10) > 0 ? Math.floor(parseInt(v.tokens, 10) / nanoTokens) : 0;

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/plans", {
        method: "PUT",
        body: jsonBody({
          id: plan?.id,
          name: v.name,
          description: v.description,
          priceCents: toCents(v.price),
          tokens: parseInt(v.tokens, 10),
          features: v.features.split("\n").map((s) => s.trim()).filter(Boolean),
          highlighted: v.highlighted,
          active: v.active,
          sort: parseInt(v.sort, 10) || 0,
        }),
      });
      toast.success(plan ? "Plan guardado" : "Plan creado");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{plan ? plan.name : "Nuevo plan"}</h3>
        {plan && <span className="font-mono text-[11px] text-muted-foreground">{plan.id}</span>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <Input value={v.name} onChange={set("name")} maxLength={40} />
        </Field>
        <Field label="Orden">
          <Input type="number" min="0" value={v.sort} onChange={set("sort")} />
        </Field>
        <Field label="Precio mensual (MXN, IVA incluido)">
          <Input type="number" min="10" step="1" value={v.price} onChange={set("price")} />
        </Field>
        <Field label="Tokens por mes" hint={perToken ? `≈ ${formatMxn(Math.round(perToken * 100))} por token · ~${images} imágenes Nano Banana` : undefined}>
          <Input type="number" min="1" step="1" value={v.tokens} onChange={set("tokens")} />
        </Field>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Descripción corta">
          <Input value={v.description} onChange={set("description")} maxLength={200} />
        </Field>
        <Field label="Prestaciones (una por línea)">
          <Textarea rows={4} value={v.features} onChange={set("features")} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={v.active} onCheckedChange={(c) => setV((s) => ({ ...s, active: c }))} /> Visible para venta
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={v.highlighted} onCheckedChange={(c) => setV((s) => ({ ...s, highlighted: c }))} /> Destacado
        </label>
        <Button className="ml-auto" disabled={busy || !v.name.trim()} onClick={save}>
          {busy && <Loader2 className="animate-spin" />} Guardar
        </Button>
      </div>
    </div>
  );
}

function PackEditor({ pack, onSaved }: { pack?: Pack; onSaved: () => void }) {
  const [v, setV] = useState({
    name: pack?.name ?? "",
    tokens: pack ? String(pack.tokens) : "",
    price: pack ? pesos(pack.price_cents) : "",
    active: pack ? !!pack.active : true,
    sort: String(pack?.sort ?? 0),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: "name" | "tokens" | "price" | "sort") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/packs", {
        method: "PUT",
        body: jsonBody({
          id: pack?.id,
          name: v.name,
          tokens: parseInt(v.tokens, 10),
          priceCents: toCents(v.price),
          active: v.active,
          sort: parseInt(v.sort, 10) || 0,
        }),
      });
      toast.success(pack ? "Paquete guardado" : "Paquete creado");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const per = parseInt(v.tokens, 10) > 0 && toCents(v.price) > 0 ? toCents(v.price) / 100 / parseInt(v.tokens, 10) : null;
  return (
    <div className={card}>
      <div className="space-y-3">
        <Field label="Nombre">
          <Input value={v.name} onChange={set("name")} maxLength={40} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tokens">
            <Input type="number" min="1" value={v.tokens} onChange={set("tokens")} />
          </Field>
          <Field label="Precio MXN">
            <Input type="number" min="10" value={v.price} onChange={set("price")} />
          </Field>
        </div>
        {per && <p className="text-[11px] text-muted-foreground">≈ {formatMxn(Math.round(per * 100))} por token</p>}
        <Field label="Orden">
          <Input type="number" min="0" value={v.sort} onChange={set("sort")} />
        </Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={v.active} onCheckedChange={(c) => setV((s) => ({ ...s, active: c }))} /> Visible
          </label>
          <Button size="sm" disabled={busy || !v.name.trim()} onClick={save}>
            {busy && <Loader2 className="animate-spin" />} Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
