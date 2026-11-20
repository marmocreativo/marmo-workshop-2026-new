"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Globe, Images, Layers, ShieldCheck, Sparkles, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { useLiveBalance } from "@/lib/balance";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/studio", label: "Studio", icon: Sparkles },
  { href: "/biblioteca", label: "Biblioteca", icon: Layers },
  { href: "/galeria", label: "Galería", icon: Images },
  { href: "/comunidad", label: "Comunidad", icon: Globe },
  { href: "/cuenta", label: "Cuenta", icon: User },
];
const ADMIN_ITEM = { href: "/admin", label: "Admin", icon: ShieldCheck };

const itemsFor = (isAdmin: boolean) => (isAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS);

// Móvil: barra inferior.
export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = itemsFor(isAdmin);
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Escritorio: riel lateral con iconos circulares.
export function DesktopRail({ isAdmin, tokens: initialTokens }: { isAdmin: boolean; tokens: number }) {
  const pathname = usePathname();
  const tokens = useLiveBalance(initialTokens);
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-3 py-5 lg:flex">
      <Link href="/" aria-label="Marmo Workshop" className="mb-3 flex w-14 justify-center">
        <Logo className="h-auto w-14" />
      </Link>
      {itemsFor(isAdmin).map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={cn(
              "flex size-12 items-center justify-center rounded-full border transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
          </Link>
        );
      })}
      <Link
        href="/cuenta"
        title="Tus tokens"
        className="mt-auto flex w-14 flex-col items-center gap-0.5 rounded-2xl border bg-card py-2 text-foreground transition-colors hover:bg-muted"
      >
        <Coins className="size-4 text-primary" />
        <span className="text-sm font-semibold">{new Intl.NumberFormat("es-MX", { notation: "compact" }).format(tokens)}</span>
        <span className="text-[9px] text-muted-foreground">tokens</span>
      </Link>
    </aside>
  );
}
