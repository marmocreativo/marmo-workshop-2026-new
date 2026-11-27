"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Images, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/planes", label: "Planes y tokens", icon: Coins },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/slider", label: "Slider del Home", icon: Images },
];

const isActive = (pathname: string, t: (typeof TABS)[number]) => (t.exact ? pathname === t.href : pathname.startsWith(t.href));

// Navegación del panel: chips en móvil, barra lateral fija en escritorio.
export function AdminNav() {
  const pathname = usePathname();
  return (
    <>
      <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isActive(pathname, t) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-56 shrink-0 flex-col rounded-xl border bg-card p-3 lg:flex">
        <p className="px-2 pt-1 pb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Administración</p>
        <nav className="flex flex-col gap-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = isActive(pathname, t);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                  on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t px-2 pt-3 text-[11px] text-muted-foreground">
          Marmo Workshop · v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
        </div>
      </aside>
    </>
  );
}
