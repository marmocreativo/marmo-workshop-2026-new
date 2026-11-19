"use client";

import { useState } from "react";
import { Bookmark, Globe, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fileUrl } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Preset } from "@/lib/types";

// Cards con la imagen de referencia de fondo para reconocer los presets de un vistazo.
export function PresetCards({
  presets,
  onApply,
  onDelete,
  onTogglePublic,
}: {
  presets: Preset[];
  onApply: (p: Preset) => void;
  onDelete: (id: string) => void;
  onTogglePublic: (p: Preset) => void;
}) {
  if (presets.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aún no tienes presets. Elige modificadores y texto extra, y guárdalos para reutilizarlos.
      </p>
    );
  }
  return (
    <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pb-2">
      {presets.map((p) => (
        <li key={p.id} className="group relative">
          <button
            type="button"
            onClick={() => onApply(p)}
            className="relative flex aspect-square w-full items-end overflow-hidden rounded-2xl border bg-muted text-left"
          >
            {p.ref_file ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl(p.ref_file)}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <Bookmark className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <span className="relative w-full p-3 text-white">
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="block truncate text-xs text-white/70">
                {p.modifier_ids.length} modificador{p.modifier_ids.length === 1 ? "" : "es"}
                {p.free_text ? ` · ${p.free_text}` : ""}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label={p.is_public ? "Público: pulsa para hacerlo privado" : "Privado: pulsa para hacerlo público"}
            title={p.is_public ? "Público (clic para hacerlo privado)" : "Privado (clic para compartirlo con la comunidad)"}
            onClick={() => onTogglePublic(p)}
            className={cn(
              "absolute top-2 left-2 flex size-7 items-center justify-center rounded-full text-white",
              p.is_public ? "bg-primary" : "bg-black/70",
            )}
          >
            {p.is_public ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Eliminar preset"
            title="Eliminar preset"
            onClick={() => confirm(`¿Eliminar el preset "${p.name}"?`) && onDelete(p.id)}
            className={cn(
              "absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/70 text-white",
              "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100",
            )}
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PresetSaveDialog({
  open,
  onOpenChange,
  hasImage,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hasImage: boolean;
  onSave: (name: string, withImage: boolean) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [withImage, setWithImage] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onSave(name.trim(), withImage && hasImage);
      setName("");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar preset</DialogTitle>
          <DialogDescription>Se guardan los modificadores elegidos y el texto extra.</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Nombre del preset"
          className="h-11 text-base"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && name.trim() && !busy && submit()}
        />
        {hasImage && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withImage}
              onChange={(e) => setWithImage(e.target.checked)}
              className="size-4 accent-primary"
            />
            Usar mi foto actual como imagen de referencia
          </label>
        )}
        <Button className="h-11" disabled={busy || !name.trim()} onClick={submit}>
          {busy && <Loader2 className="animate-spin" />} Guardar preset
        </Button>
      </DialogContent>
    </Dialog>
  );
}
