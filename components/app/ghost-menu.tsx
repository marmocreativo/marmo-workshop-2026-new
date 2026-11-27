"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuOption = { value: string; label: string; sub?: string; icon: React.ReactNode; locked?: boolean };

// Selector oscuro con icono para los controles del Studio (el select nativo no admite imágenes).
// El menú se abre hacia arriba y se alinea a un lado para no salirse de la pantalla en móvil.
export function GhostMenu({
  value,
  onChange,
  options,
  label,
  align = "left",
  disabled,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: MenuOption[];
  label: string;
  align?: "left" | "right";
  disabled?: boolean;
  /** Avisa al abrir/cerrar, para que el contenedor suba por encima de los pointers mientras el menú está abierto. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpenState(false);
        onOpenChange?.(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenState(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center gap-2 rounded-xl bg-white/10 pr-8 pl-2 text-left text-sm font-medium text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-60"
      >
        <span className="flex size-7 shrink-0 items-center justify-center">{current?.icon}</span>
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-white/70" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className={cn(
            "absolute bottom-full z-50 mb-2 max-h-64 w-52 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-white/15 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur-md",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left text-white hover:bg-white/10",
                  o.value === value && "bg-white/10",
                  o.locked && "opacity-50",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center">{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{o.label}</span>
                  {o.sub && <span className="block truncate text-[11px] text-white/60">{o.sub}</span>}
                </span>
                {o.value === value && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
