"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

// Estudio Pro: elige qué tomar de una imagen de referencia (su outfit, su fondo, su pose...).
export function ReferenceRolesDialog({
  file,
  categories,
  value,
  onSave,
  onOpenChange,
}: {
  file: File | null;
  categories: Category[];
  value: string[];
  onSave: (slugs: string[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [picked, setPicked] = useState<string[]>(value);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Qué tomamos de esta imagen?</DialogTitle>
          <DialogDescription>Elige uno o varios. Si no eliges nada, se usa como material libre.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img src={url} alt="Referencia" className="mx-auto aspect-square w-36 rounded-2xl object-cover" />}
          <div className="grid grid-cols-2 content-start gap-1.5">
            {categories.map((c) => {
              const on = picked.includes(c.slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.slug)}
                  className={cn(
                    "flex h-10 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-sm transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {on ? <Check className="size-4 shrink-0" /> : <CategoryIcon slug={c.slug} className="size-4 shrink-0" />}
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(picked);
              onOpenChange(false);
            }}
          >
            Listo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
