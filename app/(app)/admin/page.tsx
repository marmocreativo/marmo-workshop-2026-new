import Link from "next/link";
import { Activity, BarChart3, Coins, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PLACEHOLDERS = [
  { icon: Users, title: "Usuarios", text: "Altas, suscripciones activas y cancelaciones." },
  { icon: Activity, title: "Actividad", text: "Generaciones por día, modelos y proporciones más usados." },
  { icon: BarChart3, title: "Modificadores", text: "Los más usados y los que mejores resultados dan." },
  { icon: Wallet, title: "Ingresos y costos", text: "Ingresos por plan y recargas frente al gasto en fal.ai y Gemini." },
];

// El análisis de comportamiento sigue siendo un placeholder; la gestión de cobros ya está en las otras pestañas.
export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
        <Badge>Admin</Badge>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/planes" className="flex gap-4 rounded-3xl border bg-card p-5 transition-colors hover:bg-muted/50">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Coins className="size-5" />
          </div>
          <div>
            <h2 className="font-medium">Planes y tokens</h2>
            <p className="mt-1 text-sm text-muted-foreground">Precios de planes, paquetes, costo en tokens por modelo.</p>
          </div>
        </Link>
        <Link href="/admin/usuarios" className="flex gap-4 rounded-3xl border bg-card p-5 transition-colors hover:bg-muted/50">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Users className="size-5" />
          </div>
          <div>
            <h2 className="font-medium">Usuarios</h2>
            <p className="mt-1 text-sm text-muted-foreground">Saldos, cargas manuales de tokens y reembolsos.</p>
          </div>
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">Análisis de comportamiento — en construcción:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLACEHOLDERS.map(({ icon: Icon, title, text }) => (
          <section key={title} className="flex gap-4 rounded-3xl border border-dashed bg-card p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Próximamente</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
