"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { confirmAction, toast } from "@/lib/alerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { LedgerEntry, Payment } from "@/lib/billing";
import { api, jsonBody } from "@/lib/client";
import { formatMxn, formatTokens } from "@/lib/tokens";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  tokens: number;
  plan_id: string | null;
  sub_status: string | null;
  created_at: number;
};
type Detail = {
  user: AdminUser & { sub_period_end: number | null; cancel_at_period_end: number };
  ledger: LedgerEntry[];
  payments: Payment[];
};

const LEDGER_LABEL: Record<string, string> = {
  plan_grant: "Renovación de plan",
  purchase: "Compra de tokens",
  usage: "Uso",
  usage_refund: "Devolución por fallo",
  refund_revoke: "Reembolso (tokens revocados)",
  admin_adjust: "Ajuste de administrador",
  signup_bonus: "Bono de bienvenida",
};
const STATUS_LABEL: Record<string, string> = { paid: "Pagado", partially_refunded: "Reembolso parcial", refunded: "Reembolsado" };

export function UsersAdmin() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    const r = await api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`);
    setUsers(r.users);
  }, []);
  useEffect(() => {
    load("").catch((e: Error) => toast.error(e.message));
  }, [load]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Saldo de tokens, cargas manuales y reembolsos.</p>
      </header>

      <form
        className="relative max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          load(q).catch((err: Error) => toast.error(err.message));
        }}
      >
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por correo…" className="h-10 rounded-xl pl-9 text-base" />
      </form>

      <ul className="space-y-2">
        {users === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        {users?.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Sin resultados.</li>}
        {users?.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => setOpenId(u.id)}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.email}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {u.role === "admin" && <Badge>Admin</Badge>}
                  {u.plan_id ? `Plan ${u.plan_id}` : "Sin plan"}
                  {u.sub_status && ` · ${u.sub_status}`} · alta {new Date(u.created_at).toLocaleDateString("es-MX")}
                </p>
              </div>
              <p className="text-right">
                <span className="block text-lg font-semibold">{formatTokens(u.tokens)}</span>
                <span className="text-[11px] text-muted-foreground">tokens</span>
              </p>
            </button>
          </li>
        ))}
      </ul>

      <UserDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => load(q).catch(() => {})} />
    </div>
  );
}

function UserDialog({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async (uid: string) => {
    setD(await api<Detail>(`/api/admin/users/${uid}`));
  }, []);
  useEffect(() => {
    setD(null);
    setAmount("");
    setNote("");
    if (id) load(id).catch((e: Error) => toast.error(e.message));
  }, [id, load]);

  async function adjust(sign: 1 | -1) {
    const n = parseInt(amount, 10);
    if (!id || !Number.isInteger(n) || n <= 0) return toast.error("Escribe una cantidad entera mayor a 0");
    if (note.trim().length < 3) return toast.error("Escribe el motivo del movimiento");
    setBusy("adjust");
    try {
      const r = await api<{ applied: number; balance: number }>(`/api/admin/users/${id}/tokens`, {
        method: "POST",
        body: jsonBody({ amount: sign * n, note }),
      });
      toast.success(`${r.applied > 0 ? "+" : ""}${r.applied} tokens · saldo ${r.balance}`);
      setAmount("");
      setNote("");
      await load(id);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refund(p: Payment) {
    const remaining = p.amount_cents - p.refunded_cents;
    const raw = refundAmounts[p.id];
    const cents = raw ? Math.round(parseFloat(raw) * 100) : remaining;
    if (!Number.isFinite(cents) || cents < 1 || cents > remaining) return toast.error(`El monto debe estar entre $0.01 y ${formatMxn(remaining)}`);
    const revoke = Math.round((p.tokens * (p.refunded_cents + cents)) / p.amount_cents) - p.tokens_revoked;
    if (
      !(await confirmAction(
        `Se reembolsarán ${formatMxn(cents)} en Stripe (dinero real, no se puede deshacer) y se revocarán hasta ${revoke} tokens del usuario. ¿Continuar?`,
        { title: "Reembolso en Stripe", confirmText: "Reembolsar", danger: true },
      ))
    )
      return;
    setBusy(p.id);
    try {
      await api(`/api/admin/payments/${p.id}/refund`, { method: "POST", body: jsonBody({ amountCents: cents }) });
      toast.success("Reembolso realizado");
      await load(d!.user.id);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl">
        {!d ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="break-all">{d.user.email}</DialogTitle>
              <DialogDescription>
                {d.user.plan_id ? `Plan ${d.user.plan_id}` : "Sin plan"}
                {d.user.sub_status && ` · ${d.user.sub_status}`}
                {d.user.sub_period_end && d.user.plan_id && ` · renueva ${new Date(d.user.sub_period_end).toLocaleDateString("es-MX")}`}
                {d.user.cancel_at_period_end ? " · cancelación programada" : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Saldo actual</p>
              <p className="text-3xl font-semibold">{formatTokens(d.user.tokens)} <span className="text-base font-normal text-muted-foreground">tokens</span></p>
            </div>

            <section className="space-y-3 rounded-2xl border p-4">
              <h3 className="text-sm font-semibold">Carga manual de tokens</h3>
              <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                <Input type="number" min="1" step="1" inputMode="numeric" placeholder="Cantidad" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input placeholder="Motivo (obligatorio): cortesía, compensación, ajuste…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              </div>
              <div className="flex gap-2">
                <Button disabled={busy === "adjust"} onClick={() => adjust(1)}>
                  {busy === "adjust" ? <Loader2 className="animate-spin" /> : <Plus />} Abonar
                </Button>
                <Button variant="outline" disabled={busy === "adjust"} onClick={() => adjust(-1)}>
                  <Minus /> Descontar
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Pagos</h3>
              {d.payments.length === 0 && <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>}
              <ul className="space-y-2">
                {d.payments.map((p) => {
                  const remaining = p.amount_cents - p.refunded_cents;
                  return (
                    <li key={p.id} className="rounded-2xl border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {p.item_name ?? p.kind} · {formatMxn(p.amount_cents)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleString("es-MX")} · {formatTokens(p.tokens)} tokens
                            {p.refunded_cents > 0 && ` · reembolsado ${formatMxn(p.refunded_cents)} (−${p.tokens_revoked} tokens)`}
                          </p>
                        </div>
                        <Badge variant={p.status === "paid" ? "secondary" : "default"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      </div>
                      {remaining > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="h-9 w-32"
                            placeholder={`Todo (${remaining / 100})`}
                            value={refundAmounts[p.id] ?? ""}
                            onChange={(e) => setRefundAmounts((s) => ({ ...s, [p.id]: e.target.value }))}
                            aria-label="Monto a reembolsar en pesos"
                          />
                          <Button size="sm" variant="destructive" disabled={busy === p.id} onClick={() => refund(p)}>
                            {busy === p.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reembolsar
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Movimientos de tokens</h3>
              <ul className="divide-y rounded-2xl border text-sm">
                {d.ledger.length === 0 && <li className="p-3 text-muted-foreground">Sin movimientos.</li>}
                {d.ledger.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p>{LEDGER_LABEL[e.type] ?? e.type}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("es-MX")}
                        {e.note && ` · ${e.note}`}
                      </p>
                    </div>
                    <p className="text-right">
                      <span className={e.delta > 0 ? "font-semibold text-emerald-500" : "font-semibold"}>
                        {e.delta > 0 ? "+" : ""}
                        {e.delta}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">saldo {e.balance_after}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
