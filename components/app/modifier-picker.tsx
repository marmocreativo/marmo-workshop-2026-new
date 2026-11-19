"use client";

import { useMemo, useState } from "react";
import { Check, Plus, ScanSearch, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fileUrl } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Category, Modifier } from "@/lib/types";
import { CategorySelect } from "./category-select";

type BrowserProps = {
  categories: Category[];
  modifiers: Modifier[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  className?: string;
};

// Buscador + categorías + lista seleccionable. Se usa en el panel móvil y en la columna de escritorio.
export function ModifierBrowser({ categories, modifiers, selected, onToggle, className }: BrowserProps) {
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modifiers
      .filter((m) => {
        if (q) return m.text.toLowerCase().includes(q);
        if (tab === "all" || tab === "new") return true;
        if (tab === "favs") return m.favorite === 1;
        if (tab === "top") return m.usage_count > 0;
        return m.category_id === tab;
      })
      .sort((a, b) =>
        tab === "new"
          ? b.created_at - a.created_at
          : tab === "top"
            ? b.usage_count - a.usage_count
            : b.favorite - a.favorite || b.usage_count - a.usage_count,
      );
  }, [modifiers, tab, search]);

  const catOf = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="h-10 rounded-xl pl-9 text-base"
        />
      </div>
      <CategorySelect
        value={tab}
        onChange={setTab}
        categories={categories}
        extra={[
          { value: "all", label: "Todos" },
          { value: "new", label: "Más nuevos" },
          { value: "favs", label: "★ Favoritos" },
          { value: "top", label: "Más usados" },
        ]}
      />

      <ul className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-2">
        {list.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Nada por aquí todavía.</li>}
        {list.map((m) => {
          const on = selected.has(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onToggle(m.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                  on ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    on && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{m.text}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {(search || ["all", "new", "favs", "top"].includes(tab)) &&`${catOf(m.category_id)} · `}
                    {m.usage_count} {m.usage_count === 1 ? "uso" : "usos"}
                  </span>
                  {(m.origin_file || (m.thumbs?.length ?? 0) > 0) && (
                    <span className="mt-2 flex items-center gap-1.5">
                      {m.origin_file && (
                        <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl ring-2 ring-primary/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fileUrl(m.origin_file)} alt="Imagen de origen" loading="lazy" className="size-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/70 py-0.5 text-[9px] font-medium text-white">
                            <ScanSearch className="size-2.5" /> Origen
                          </span>
                        </span>
                      )}
                      {m.thumbs?.map((f) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={f} src={fileUrl(f)} alt="Resultado de referencia" loading="lazy" className="size-14 shrink-0 rounded-xl border object-cover" />
                      ))}
                    </span>
                  )}
                </span>
                {m.favorite === 1 && <Star className="size-4 shrink-0 fill-accent text-accent" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type PickerProps = Omit<BrowserProps, "className"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
};

export function ModifierPicker({ open, onOpenChange, onCreate, ...browser }: PickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] gap-0 rounded-t-3xl p-0" showCloseButton={false}>
        <SheetHeader className="flex-row items-center justify-between px-4 pt-4 pb-3">
          <SheetTitle className="text-lg">Modificadores</SheetTitle>
          <SheetDescription className="sr-only">Elige los modificadores que se aplicarán a la foto.</SheetDescription>
          <Button variant="outline" size="sm" onClick={onCreate}>
            <Plus /> Nuevo
          </Button>
        </SheetHeader>
        <ModifierBrowser {...browser} className="px-4" />
        <div className="pb-safe border-t p-3">
          <Button className="h-11 w-full" onClick={() => onOpenChange(false)}>
            Listo{browser.selected.size > 0 && ` (${browser.selected.size})`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
