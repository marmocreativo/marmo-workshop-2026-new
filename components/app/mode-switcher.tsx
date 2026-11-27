"use client";

import { Package, PartyPopper, SlidersHorizontal, Sun } from "lucide-react";
import { MODES, type StudioMode } from "@/lib/modes";
import { cn } from "@/lib/utils";
import type { StudioState } from "./use-studio";

export const MODE_ICONS: Record<StudioMode, React.ComponentType<{ className?: string }>> = {
  ocio: PartyPopper,
  filtro: Sun,
  producto: Package,
  pro: SlidersHorizontal,
};

// Selector de modo del Studio: cambia qué presets, modificadores y controles se muestran.
export function ModeSwitcher({ s }: { s: StudioState }) {
  const locked = !!s.tour.step; // durante el tutorial se queda en el modo elegido al inicio
  return (
    <div role="tablist" aria-label="Modo" className="grid shrink-0 grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
      {MODES.map((m) => {
        const Icon = MODE_ICONS[m.id];
        const on = s.mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={locked && !on}
            title={m.tagline}
            onClick={() => s.setMode(m.id)}
            className={cn(
              "flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors disabled:opacity-40 sm:h-10 sm:flex-row sm:gap-1.5 sm:text-[13px] lg:h-11 lg:text-sm",
              on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="max-w-full truncate">{m.id === "pro" ? <><span className="sm:hidden">Pro</span><span className="max-sm:hidden">{m.label}</span></> : m.label}</span>
            <span className={cn("hidden truncate text-xs font-normal xl:inline", on ? "opacity-80" : "opacity-60")}>· {m.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
