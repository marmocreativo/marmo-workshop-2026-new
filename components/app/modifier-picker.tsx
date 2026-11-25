"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Category, Modifier } from "@/lib/types";
import { CategorySelect } from "./category-select";
import { CategoryIcon } from "./category-icon";
import { Card, ResultsPopover, type CardHover } from "./preset-cards";

type BrowserProps = {
  categories: Category[];
  modifiers: Modifier[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** Marca o desmarca como favorito (aparece primero). */
  onFavorite?: (m: Modifier) => void;
  className?: string;
  /** Escritorio: una sola categoría a la vez (sin "Todos"); abre en "Más usados" o en la primera categoría. */
  focused?: boolean;
};

// Buscador + categorías + lista seleccionable. Se usa en el panel móvil y en la columna de escritorio.
export function ModifierBrowser({ categories, modifiers, selected, onToggle, onFavorite, className, focused }: BrowserProps) {
  const [picked, setPicked] = useState<string | null>(focused ? null : "all");
  const [search, setSearch] = useState("");
  const [hover, setHover] = useState<CardHover | null>(null);
  const hasTop = modifiers.some((m) => m.usage_count > 0);
  // Enfocado: sin elección explícita se abre en "Más usados" o, si no hay, en la primera categoría.
  const tab = picked ?? (focused ? (hasTop ? "top" : (categories[0]?.id ?? "top")) : "all");
  const setTab = setPicked;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modifiers
      .filter((m) => {
        if (q) return m.text.toLowerCase().includes(q);
        if (tab === "all" || tab === "new") return true;
        if (tab === "favs") return m.favorite === 1;
        if (tab === "applied") return selected.has(m.id);
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
  }, [modifiers, tab, search, selected]);

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
          ...(focused ? [] : [{ value: "all", label: "Todos" }]),
          { value: "new", label: "Más nuevos" },
          { value: "applied", label: `✓ Aplicados (${selected.size})` },
          { value: "favs", label: "★ Favoritos" },
          { value: "top", label: "Más usados" },
        ]}
      />

      {/* Grid de tarjetas (como los presets): imagen de origen de fondo, texto al centro y resultados al pasar el mouse. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nada por aquí todavía.</p>}
        <ul className="grid grid-cols-2 content-start gap-2">
          {list.map((m) => {
            const on = selected.has(m.id);
            const showCat = !!search || ["all", "new", "favs", "top", "applied"].includes(tab);
            const results = [...(m.origin_file ? [m.origin_file] : []), ...(m.thumbs ?? [])].slice(0, 8);
            const slug = categories.find((c) => c.id === m.category_id)?.slug;
            return (
              <Card
                key={m.id}
                name={m.text}
                cover={m.origin_file ?? m.thumbs?.[0] ?? null}
                active={on}
                results={results}
                onClick={() => onToggle(m.id)}
                onHover={setHover}
                fallback={<CategoryIcon slug={slug} />}
                textClassName="line-clamp-5 text-xs font-medium"
              >
                {onFavorite && (
                  <button
                    type="button"
                    onClick={() => onFavorite(m)}
                    aria-label={m.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                    aria-pressed={m.favorite === 1}
                    title={m.favorite ? "Quitar de favoritos" : "Favorito: aparece primero"}
                    className={cn(
                      "absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black",
                      !m.favorite && "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100",
                    )}
                  >
                    <Star className={cn("size-3.5", m.favorite === 1 && "fill-amber-400 text-amber-400")} />
                  </button>
                )}
                <span className="pointer-events-none absolute inset-x-2 bottom-2 truncate text-center text-[10px] text-white/70">
                  {showCat && `${catOf(m.category_id)} · `}
                  {m.usage_count} {m.usage_count === 1 ? "uso" : "usos"}
                </span>
              </Card>
            );
          })}
        </ul>
      </div>
      {hover && <ResultsPopover key={hover.name + hover.rect.top} h={hover} />}
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
