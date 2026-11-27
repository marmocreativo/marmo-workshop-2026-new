import Link from "next/link";
import { Activity, Coins, CreditCard, Sparkles, UserPlus, Users, Wallet } from "lucide-react";
import { DedupeButton } from "@/components/admin/dedupe-button";
import { one, query } from "@/lib/db";
import { getModel } from "@/lib/models";
import { formatMxn, formatTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const fmtUsd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const num = (n: number | null | undefined) => new Intl.NumberFormat("es-MX").format(n ?? 0);

async function stats() {
  const now = Date.now();
  const d30 = now - 30 * DAY;
  const d7 = now - 7 * DAY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [users, gens, pay, models, days, recent] = await Promise.all([
    one<{ total: number; new7: number; subs: number }>(
      `SELECT COUNT(*) AS total, SUM(created_at>=?) AS new7, SUM(sub_status IN ('active','trialing','past_due')) AS subs FROM users`,
      [d7],
    ),
    one<{ today: number; d30: number; cost: number | null; errors: number }>(
      `SELECT SUM(created_at>=?) AS today, COUNT(*) AS d30, SUM(CASE WHEN status!='error' THEN cost_usd END) AS cost, SUM(status='error') AS errors
       FROM generations WHERE created_at>=?`,
      [today.getTime(), d30],
    ),
    one<{ revenue: number | null; count: number }>(
      "SELECT SUM(amount_cents-refunded_cents) AS revenue, COUNT(*) AS count FROM payments WHERE created_at>=?",
      [d30],
    ),
    query<{ model: string; n: number }>(
      "SELECT model, COUNT(*) AS n FROM generations WHERE created_at>=? GROUP BY model ORDER BY n DESC LIMIT 6",
      [d30],
    ),
    query<{ day: string; n: number }>(
      `SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n
       FROM generations WHERE created_at>=? GROUP BY day ORDER BY day`,
      [now - 14 * DAY],
    ),
    query<{ email: string; item_name: string | null; amount_cents: number; tokens: number; created_at: number }>(
      `SELECT u.email, p.item_name, p.amount_cents, p.tokens, p.created_at FROM payments p JOIN users u ON u.id=p.user_id
       ORDER BY p.created_at DESC LIMIT 6`,
    ),
  ]);
  return { users, gens, pay, models, days, recent };
}

export default async function AdminPage() {
  const { users, gens, pay, models, days, recent } = await stats();
  const kpis = [
    { icon: Users, label: "Usuarios", value: num(users?.total), sub: `+${num(users?.new7)} en 7 días` },
    { icon: CreditCard, label: "Suscripciones activas", value: num(users?.subs), sub: `${num((users?.total ?? 0) - (users?.subs ?? 0))} en tier gratuito` },
    { icon: Sparkles, label: "Generaciones hoy", value: num(gens?.today), sub: `${num(gens?.d30)} en 30 días` },
    { icon: Wallet, label: "Ingresos 30 días", value: formatMxn(pay?.revenue ?? 0), sub: `${num(pay?.count)} pagos` },
    { icon: Activity, label: "Costo IA 30 días", value: fmtUsd(gens?.cost ?? 0), sub: `${num(gens?.errors)} fallidas` },
  ];
  const max = Math.max(1, ...days.map((d) => d.n));
  const maxModel = Math.max(1, ...models.map((m) => m.n));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted-foreground">Últimos 30 días, salvo que se indique otra cosa.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/usuarios" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted">
            <UserPlus className="size-4" /> Usuarios
          </Link>
          <Link href="/admin/planes" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted">
            <Coins className="size-4" /> Planes y tokens
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ icon: Icon, label, value, sub }) => (
          <section key={label} className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Icon className="size-4" /> {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Generaciones por día · 14 días</h2>
          {days.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin actividad todavía.</p>
          ) : (
            <div className="mt-4 flex h-40 items-end gap-1.5">
              {days.map((d) => (
                <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.n}`}>
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">{d.n}</span>
                  <div className="w-full rounded-t-sm bg-primary/80 group-hover:bg-primary" style={{ height: `${(d.n / max) * 100}%` }} />
                  <span className="text-[10px] text-muted-foreground">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Modelos más usados</h2>
          <ul className="mt-3 space-y-2.5">
            {models.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Sin datos.</li>}
            {models.map((m) => (
              <li key={m.model}>
                <div className="flex justify-between text-xs">
                  <span>{getModel(m.model)?.label ?? m.model}</span>
                  <span className="tabular-nums text-muted-foreground">{num(m.n)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(m.n / maxModel) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Pagos recientes</h2>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay pagos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Usuario</th>
                  <th className="px-4 py-2 font-medium">Concepto</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{new Date(p.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="max-w-64 truncate px-4 py-2">{p.email}</td>
                    <td className="px-4 py-2">{p.item_name ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatTokens(p.tokens)}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMxn(p.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DedupeButton />
    </div>
  );
}
