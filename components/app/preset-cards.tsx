"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, Globe, Loader2, Lock, Star, X } from "lucide-react";
import { confirmAction, toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { CommunityPreset, Preset } from "@/lib/types";

export type CardHover = { files: string[]; name: string; rect: DOMRect };
type Hover = CardHover;

// Escritorio: al pasar el mouse sobre una tarjeta, carrusel con los resultados hechos con ese preset.
export function ResultsPopover({ h }: { h: Hover }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (h.files.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % h.files.length), 1400);
    return () => clearInterval(t);
  }, [h.files.length]);
  const w = 300;
  const left = h.rect.right + 12 + w < window.innerWidth ? h.rect.right + 12 : Math.max(12, h.rect.left - w - 12);
  const top = Math.max(12, Math.min(h.rect.top + h.rect.height / 2 - 200, window.innerHeight - 412));
  return (
    <div className="pointer-events-none fixed z-[100] overflow-hidden rounded-2xl border bg-black shadow-2xl" style={{ left, top, width: w }}>
      <div className="relative aspect-[3/4]">
        {h.files.map((f, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={f}
            src={fileUrl(f)}
            alt=""
            className={cn("absolute inset-0 size-full object-cover transition-opacity duration-500", k === i ? "opacity-100" : "opacity-0")}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 bg-black/85 px-3 py-2 text-xs text-white">
        <span className="truncate font-medium">{h.name}</span>
        <span className="flex shrink-0 gap-1">
          {h.files.map((f, k) => (
            <span key={f} className={cn("size-1.5 rounded-full", k === i ? "bg-white" : "bg-white/35")} />
          ))}
        </span>
      </div>
    </div>
  );
}

const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Tarjeta: imagen de origen de fondo con overlay negro al 60 % y el nombre al centro.
// Se usa para presets y para modificadores (Estudio Pro).
export function Card({
  name,
  cover,
  active,
  results,
  onClick,
  onHover,
  children,
  fallback,
  textClassName,
}: {
  name: string;
  cover: string | null;
  active?: boolean;
  results?: string[];
  onClick: () => void;
  onHover: (h: Hover | null) => void;
  children?: React.ReactNode;
  /** Icono de fondo cuando no hay imagen. */
  fallback?: React.ReactNode;
  textClassName?: string;
}) {
  return (
    <li
      className="group relative"
      onMouseEnter={(e) => results?.length && canHover() && onHover({ files: results, name, rect: e.currentTarget.getBoundingClientRect() })}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border bg-muted p-3 text-center",
          active && "ring-3 ring-primary",
        )}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(cover)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/15 [&_svg]:size-12">{fallback ?? <Bookmark />}</span>
        )}
        <span className="absolute inset-0 bg-black/60" />
        <span className={cn("relative line-clamp-3 text-sm leading-snug font-semibold break-words text-white", textClassName)}>{name}</span>
      </button>
      {/* Indicador de seleccionado */}
      <span
        className={cn(
          "pointer-events-none absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-2",
          active ? "border-primary bg-primary text-primary-foreground" : "border-white/70 bg-black/30",
        )}
      >
        {active && <Check className="size-3.5" />}
      </span>
      {children}
    </li>
  );
}

const iconBtn = "flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black";

export function PresetCards({
  presets,
  activeId,
  results = {},
  onApply,
  onDelete,
  onTogglePublic,
  onFavorite,
}: {
  presets: Preset[];
  activeId?: string | null;
  results?: Record<string, string[]>;
  onApply: (p: Preset) => void;
  onDelete: (id: string) => void;
  onTogglePublic: (p: Preset) => void;
  onFavorite?: (p: Preset) => void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  if (presets.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Aún no tienes presets propios. Elige modificadores y prompt manual, y guárdalos para reutilizarlos.
      </p>
    );
  }
  return (
    <>
      <ul className="grid grid-cols-2 content-start gap-2">
        {presets.map((p) => (
          <Card key={p.id} name={p.name} cover={p.ref_file} active={activeId === p.id} results={results[p.id]} onClick={() => onApply(p)} onHover={setHover}>
            <div className="absolute top-2 right-2 flex gap-1">
              {onFavorite && (
                <button
                  type="button"
                  aria-label={p.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                  aria-pressed={!!p.favorite}
                  title={p.favorite ? "Quitar de favoritos" : "Favorito: aparece primero"}
                  onClick={() => onFavorite(p)}
                  className={cn(iconBtn, !p.favorite && "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100")}
                >
                  <Star className={cn("size-3.5", p.favorite && "fill-amber-400 text-amber-400")} />
                </button>
              )}
              <button
                type="button"
                aria-label={p.is_public ? "Público: pulsa para hacerlo privado" : "Privado: pulsa para hacerlo público"}
                title={p.is_public ? "Público (clic para hacerlo privado)" : "Privado (clic para compartirlo con la comunidad)"}
                onClick={() => onTogglePublic(p)}
                className={cn(iconBtn, p.is_public ? "bg-primary hover:bg-primary" : "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100")}
              >
                {p.is_public ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Eliminar preset"
                title="Eliminar preset"
                onClick={async () => (await confirmAction("Se borrará de tu biblioteca.", { title: `¿Eliminar el preset "${p.name}"?`, confirmText: "Eliminar", danger: true })) && onDelete(p.id)}
                className={cn(iconBtn, "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100")}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </ul>
      {hover && <ResultsPopover key={hover.name + hover.rect.top} h={hover} />}
    </>
  );
}

// Presets públicos de otros usuarios: al tocar uno se copia a tu biblioteca y se aplica.
export function CommunityPresetCards({ presets, onUse }: { presets: CommunityPreset[]; onUse: (p: CommunityPreset) => void }) {
  if (presets.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 content-start gap-2">
      {presets.map((p) => (
        <Card key={p.id} name={p.name} cover={p.ref_file} onClick={() => onUse(p)} onHover={() => {}} />
      ))}
    </ul>
  );
}

export function PresetSaveDialog({
  open,
  onOpenChange,
  hasImage,
  materialCount = 0,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hasImage: boolean;
  materialCount?: number;
  onSave: (name: string, withImage: boolean, instructions: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [withImage, setWithImage] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onSave(name.trim(), withImage && hasImage, instructions.trim());
      setName("");
      setInstructions("");
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
          <DialogDescription>Se guardan los modificadores elegidos y el prompt manual.</DialogDescription>
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
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Instrucciones (opcional): se muestran al elegir el preset, p. ej. qué materiales subir"
          className="text-base"
        />
        {materialCount > 0 && (
          <p className="text-sm text-muted-foreground">
            Se guardarán también tus {materialCount} material{materialCount === 1 ? "" : "es"} actuales; podrás editarlos después.
          </p>
        )}
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
