"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Copy, Download, Globe, Lock, Recycle, Trash2 } from "lucide-react";
import { confirmAction, toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fileUrl } from "@/lib/client";
import { MODELS } from "@/lib/models";
import type { Generation } from "@/lib/types";
import type { ReusePart } from "./use-studio";

type Props = {
  items: Generation[];
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  onDelete: (id: string) => Promise<void> | void;
  onReuse?: (g: Generation, parts: ReusePart[]) => void;
  onModifierClick?: (modifierId: string) => void;
  /** Guarda los modificadores y el texto extra del resultado como preset (su imagen es la portada). */
  onSavePreset?: (g: Generation, name: string) => Promise<void>;
  /** Cambia la visibilidad pública del resultado o de su referencia. */
  onVisibility?: (g: Generation, patch: { isPublic?: boolean; sourcePublic?: boolean }) => void;
  /** Vista de comunidad (resultado ajeno): sin borrar, reutilizar ni privacidad. */
  readOnly?: boolean;
  footer?: (g: Generation) => React.ReactNode;
};

const REUSE: { parts: ReusePart[]; label: string }[] = [
  { parts: ["reference", "modifiers", "text", "model"], label: "Todo" },
  { parts: ["reference"], label: "Referencia" },
  { parts: ["result"], label: "Este resultado" },
  { parts: ["modifiers"], label: "Modificadores" },
  { parts: ["text"], label: "Texto" },
  { parts: ["model"], label: "Modelo" },
];

// Botón que se despliega en un campo de nombre para guardar el resultado como preset.
function SavePresetRow({ g, onSave }: { g: Generation; onSave: (g: Generation, name: string) => Promise<void> }) {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await onSave(g, name.trim());
      setName(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (name === null) {
    return (
      <Button variant="outline" className="h-10 w-full rounded-xl" onClick={() => setName("")}>
        <Bookmark /> Guardar como preset
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Nombre del preset"
        autoFocus
        className="h-10 flex-1 text-base"
        onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
      />
      <Button className="h-10" disabled={busy || !name.trim()} onClick={submit}>
        Guardar
      </Button>
    </div>
  );
}

export function GenerationLightbox({
  items,
  openId,
  onOpenChange,
  onDelete,
  onReuse,
  onModifierClick,
  onSavePreset,
  onVisibility,
  readOnly,
  footer,
}: Props) {
  const index = items.findIndex((g) => g.id === openId);
  const g = index >= 0 ? items[index] : null;

  const go = (delta: number) => {
    const next = items[index + delta];
    if (next) onOpenChange(next.id);
  };

  useEffect(() => {
    if (!g) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.id, index, items]);

  const modelLabel = (id: string) => MODELS.find((m) => m.id === id)?.label ?? id;

  async function remove() {
    if (!g || !(await confirmAction("Esta acción no se puede deshacer.", { title: "¿Eliminar este resultado?", confirmText: "Eliminar", danger: true }))) return;
    const next = items[index + 1] ?? items[index - 1];
    await onDelete(g.id);
    onOpenChange(next?.id ?? null);
  }

  return (
    <Dialog open={!!g} onOpenChange={(o) => !o && onOpenChange(null)}>
      <DialogContent className="max-h-[92dvh] max-w-[calc(100%-1rem)] overflow-y-auto p-3 sm:max-w-5xl lg:p-4">
        {g && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              {g.result_file ? (
                g.kind === "video" ? (
                  <video src={fileUrl(g.result_file)} controls playsInline className="max-h-[78dvh] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(g.result_file)} alt="Resultado" className="max-h-[78dvh] w-full object-contain" />
                )
              ) : (
                <p className="p-10 text-sm text-muted-foreground">{g.error ?? "Sin resultado"}</p>
              )}
              {index > 0 && (
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <ChevronLeft />
                </button>
              )}
              {index < items.length - 1 && (
                <button
                  type="button"
                  aria-label="Siguiente"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <ChevronRight />
                </button>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:max-h-[78dvh] lg:overflow-y-auto lg:pr-1">
              <div>
                <DialogTitle className="text-lg">{modelLabel(g.model)}</DialogTitle>
                <DialogDescription>
                  {new Date(g.created_at).toLocaleString("es-MX")}
                  {g.aspect_ratio && ` · Proporción ${g.aspect_ratio === "auto" ? "automática" : g.aspect_ratio}`}
                  {g.tokens_spent ? ` · ${g.tokens_spent} tokens` : ""}
                </DialogDescription>
              </div>

              {g.source_file && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Imagen de referencia</h3>
                  <a href={fileUrl(g.source_file)} target="_blank" rel="noreferrer" className="block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(g.source_file)} alt="Referencia" className="h-28 rounded-xl border object-cover" />
                  </a>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Prompt completo</h3>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => navigator.clipboard.writeText(g.prompt).then(() => toast.success("Prompt copiado"))}
                  >
                    <Copy className="size-3" /> Copiar
                  </button>
                </div>
                <p className="rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{g.prompt}</p>
              </section>

              {g.modifiers.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Modificadores</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.modifiers.map((m) => (
                      <li key={m.modifier_id}>
                        <button
                          type="button"
                          disabled={!onModifierClick}
                          onClick={() => onModifierClick?.(m.modifier_id)}
                          className="rounded-full bg-primary/15 px-3 py-1.5 text-left text-xs text-primary disabled:cursor-default"
                        >
                          {m.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {g.error && <p className="text-sm text-destructive">{g.error}</p>}

              {!readOnly && onVisibility && (
                <section className="space-y-3 rounded-2xl border p-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                    {g.is_public || g.source_public ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                    Privacidad
                  </h3>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      Resultado público
                      <span className="block text-xs text-muted-foreground">
                        Otros verán la imagen, el prompt y los modificadores.
                      </span>
                    </span>
                    <Switch checked={!!g.is_public} onCheckedChange={(v) => onVisibility(g, { isPublic: v })} />
                  </label>
                  {g.source_file && !g.source_deleted_at && (
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        Referencia pública
                        <span className="block text-xs text-muted-foreground">Comparte también la foto original.</span>
                      </span>
                      <Switch checked={!!g.source_public} onCheckedChange={(v) => onVisibility(g, { sourcePublic: v })} />
                    </label>
                  )}
                </section>
              )}

              {onSavePreset && !readOnly && g.result_file && g.kind === "image" && (g.modifiers.length > 0 || g.free_text) && (
                <SavePresetRow key={g.id} g={g} onSave={onSavePreset} />
              )}

              {onReuse && !readOnly && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                    <Recycle className="size-3.5" /> Reutilizar en el editor
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {REUSE.filter(
                      (r) =>
                        (!r.parts.includes("result") || (g.kind === "image" && g.result_file)) &&
                        (!r.parts.includes("modifiers") || g.modifiers.length > 0 || r.parts.length > 1),
                    ).map((r) => (
                      <Button
                        key={r.label}
                        size="sm"
                        variant={r.label === "Todo" ? "default" : "outline"}
                        onClick={() => {
                          onReuse(g, r.parts);
                          onOpenChange(null);
                        }}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-auto flex gap-2 pt-2">
                {g.result_file && (
                  <a
                    href={fileUrl(g.result_file)}
                    download
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-medium"
                  >
                    <Download className="size-4" /> Descargar
                  </a>
                )}
                {!readOnly && (
                  <Button variant="destructive" className="h-10 flex-1 rounded-xl" onClick={remove}>
                    <Trash2 /> Eliminar
                  </Button>
                )}
              </div>
              {footer?.(g)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
