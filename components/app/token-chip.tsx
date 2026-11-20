"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useLiveBalance } from "@/lib/balance";

// Saldo en la barra superior móvil; se actualiza en vivo.
export function TokenChip({ initial }: { initial: number }) {
  const tokens = useLiveBalance(initial);
  return (
    <Link href="/cuenta" className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
      <Coins className="size-4 text-primary" /> {new Intl.NumberFormat("es-MX").format(tokens)}
    </Link>
  );
}
