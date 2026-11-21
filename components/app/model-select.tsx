"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MODELS, getModel, modelIcon } from "@/lib/models";
import { cn } from "@/lib/utils";

// Selector de modelo con icono (el select nativo no permite imágenes). El menú se abre hacia arriba.
export function ModelSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModel(value) ?? MODELS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-label="Modelo"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center gap-2 rounded-xl bg-white/10 pr-8 pl-1.5 text-left text-sm font-medium text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Image src={modelIcon(current.id)} alt="" width={28} height={28} className="size-7 shrink-0 rounded-lg object-cover" />
        <span className="truncate">{current.label}</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-white/70" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 bottom-full left-0 z-50 mb-2 max-h-72 min-w-56 overflow-y-auto rounded-2xl border border-white/15 bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur-md"
        >
          {MODELS.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-2 text-left text-white hover:bg-white/10",
                  m.id === value && "bg-white/10",
                )}
              >
                <Image src={modelIcon(m.id)} alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-white/60">{m.provider}{m.kind === "video" ? " · Video" : ""}</span>
                </span>
                {m.id === value && <Check className="size-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
