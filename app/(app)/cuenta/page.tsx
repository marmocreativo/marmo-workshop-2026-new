import { AccountActions } from "@/components/app/account-actions";
import { BillingPanel } from "@/components/app/billing-panel";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const user = await requireUser();
  const { pago } = await searchParams;

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-6 lg:max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cuenta</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {user.email}
          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
            {user.role === "admin" ? "Administrador" : "Usuario"}
          </Badge>
        </p>
      </header>

      {pago === "ok" && (
        <p className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">
          ¡Gracias! Estamos confirmando tu pago; en unos segundos verás tus tokens.
        </p>
      )}
      {pago === "cancelado" && <p className="rounded-2xl bg-muted p-3 text-sm">No se completó el pago. No se hizo ningún cargo.</p>}

      <BillingPanel justPaid={pago === "ok"} />
      <AccountActions />
    </div>
  );
}
