"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, ImagePlus, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { requestBalanceRefresh } from "@/lib/balance";
import { toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, resizeImage } from "@/lib/client";
import { cn } from "@/lib/utils";
import { MODES, type StudioMode } from "@/lib/modes";
import type { Category, Modifier, Preset } from "@/lib/types";
import { CategorySelect } from "./category-select";
import { ModifierEditor } from "./modifier-editor";

// Edita un preset existente: nombre, prompt manual, modificadores y portada.
type Props = {
  preset: Preset | null;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  modifiers: Modifier[];
  onSaved: () => void | Promise<void>;
};

export function PresetEditor(props: Props) {
  const { preset, onOpenChange } = props;
  return (
    <Dialog open={!!preset} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Editar preset</DialogTitle>
          <DialogDescription>
            Cambia su nombre, el prompt manual, los modificadores o la portada.
          </DialogDescription>
        </DialogHeader>
        {preset && <PresetForm key={preset.id} {...props} preset={preset} />}
      </DialogContent>
    </Dialog>
  );
}

function MatThumb({ src, file, onRemove }: { src?: string; file?: File; onRemove: () => void }) {
  const url = useMemo(() => src ?? (file ? URL.createObjectURL(file) : ""), [src, file]);
  useEffect(() => () => {
    if (file) URL.revokeObjectURL(url);
  }, [file, url]);
  return (
    <div className="relative size-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Material" className="size-full rounded-xl border object-cover" />
      <button
        type="button"
        aria-label="Quitar material"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function PresetForm({
  preset,
  onOpenChange,
  categories,
  modifiers,
  onSaved,
}: Props & { preset: Preset }) {
  const [name, setName] = useState(preset.name);
  const [freeText, setFreeText] = useState(preset.free_text ?? "");
  const [instructions, setInstructions] = useState(preset.instructions ?? "");
  const [mode, setMode] = useState<StudioMode>(preset.mode);
  const [keepMats, setKeepMats] = useState<string[]>(preset.materials ?? []);
  const [newMats, setNewMats] = useState<File[]>([]);
  const [editingMod, setEditingMod] = useState<Modifier | null>(null);
  const matRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(preset.modifier_ids),
  );
  const [cat, setCat] = useState("all");
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genCover, setGenCover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    },
    [coverUrl],
  );

  const list = useMemo(() => {
    // Los ya elegidos primero, para verlos de inmediato.
    const filtered = modifiers.filter(
      (m) => cat === "all" || m.category_id === cat || selected.has(m.id),
    );
    return [...filtered].sort(
      (a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)),
    );
  }, [modifiers, cat, selected]);

  async function pickCover(file: File | undefined) {
    if (!file) return;
    try {
      const small = await resizeImage(file, 1024);
      setCover(small);
      setRemoveCover(false);
      setCoverUrl(URL.createObjectURL(small));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Portada con IA: usa el nombre, el modo, el prompt y los modificadores elegidos (aún sin guardar).
  async function generateCover() {
    if (!name.trim()) return toast.error("Ponle un nombre al preset");
    setGenCover(true);
    try {
      const res = await fetch("/api/presets/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mode, freeText, modifierIds: [...selected] }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "No se pudo generar la portada");
      const blob = await res.blob();
      const file = new File([blob], "portada." + (blob.type.includes("png") ? "png" : "jpg"), { type: blob.type });
      setCover(file);
      setRemoveCover(false);
      setCoverUrl(URL.createObjectURL(file));
      toast.success("Portada generada: guarda el preset para conservarla");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenCover(false);
      requestBalanceRefresh();
    }
  }

  async function save() {
    if (!name.trim()) return toast.error("Ponle un nombre al preset");
    if (selected.size === 0 && !freeText.trim())
      return toast.error(
        "Elige al menos un modificador o escribe un prompt manual",
      );
    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("freeText", freeText.trim());
      form.set("instructions", instructions.trim());
      form.set("mode", mode);
      form.set("modifierIds", JSON.stringify([...selected]));
      form.set("keepMaterials", JSON.stringify(keepMats));
      for (const f of newMats) form.append("materials", f);
      if (cover) form.set("image", cover);
      if (removeCover) form.set("removeImage", "1");
      await api(`/api/presets/${preset.id}`, { method: "PATCH", body: form });
      await onSaved();
      toast.success("Preset actualizado");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shownCover =
    coverUrl ??
    (!removeCover && preset.ref_file ? fileUrl(preset.ref_file) : null);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Columna 1: imagen y materiales */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="relative flex aspect-square w-full max-w-48 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
              {shownCover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownCover} alt="Portada" className="size-full object-cover" />
              ) : (
                <Bookmark className="size-10 text-muted-foreground/40" />
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickCover(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus /> {shownCover ? "Cambiar" : "Agregar portada"}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={genCover} onClick={generateCover} title="Genera una portada con IA a partir del preset (cuesta lo mismo que un análisis)">
                {genCover ? <Loader2 className="animate-spin" /> : <Sparkles />} {genCover ? "Generando…" : "Generar con IA"}
              </Button>
              {shownCover && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setCover(null);
                    setCoverUrl(null);
                    setRemoveCover(true);
                  }}
                >
                  <Trash2 /> Quitar
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Materiales</label>
            <p className="text-xs text-muted-foreground">Imágenes extra (logos, prendas, fondos) que se cargan al elegir el preset.</p>
            <input
              ref={matRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={async (e) => {
                const room = Math.max(0, 3 - keepMats.length - newMats.length);
                const picked = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, room);
                e.target.value = "";
                const small = await Promise.all(picked.map((f) => resizeImage(f, 1280).catch(() => f)));
                setNewMats((m) => [...m, ...small]);
              }}
            />
            <div className="flex flex-wrap gap-2">
              {keepMats.map((f) => (
                <MatThumb key={f} src={fileUrl(f)} onRemove={() => setKeepMats((k) => k.filter((x) => x !== f))} />
              ))}
              {newMats.map((f, i) => (
                <MatThumb key={i} file={f} onRemove={() => setNewMats((m) => m.filter((_, k) => k !== i))} />
              ))}
              {keepMats.length + newMats.length < 3 && (
                <button
                  type="button"
                  aria-label="Agregar material"
                  onClick={() => matRef.current?.click()}
                  className="flex size-16 items-center justify-center rounded-xl border border-dashed text-muted-foreground hover:bg-muted"
                >
                  <ImagePlus className="size-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Columna 2: datos, prompt e instrucciones */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nombre del preset" className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Modo</label>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn("h-9 truncate rounded-lg px-1 text-xs font-medium", mode === m.id ? "bg-background shadow-sm" : "text-muted-foreground")}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">El preset solo aparece en este modo del estudio.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prompt manual</label>
            <Textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} maxLength={1000} rows={5} placeholder="Describe modificaciones extra" className="text-base" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Instrucciones</label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Mensaje que se muestra al elegir el preset (opcional)"
              className="text-base"
            />
          </div>
        </div>

        {/* Columna 3: modificadores */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Modificadores</label>
            <span className="text-xs text-muted-foreground">{selected.size} elegidos</span>
          </div>
          <CategorySelect value={cat} onChange={setCat} categories={categories} extra={[{ value: "all", label: "Todas las categorías" }]} />
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1 lg:max-h-[52dvh]">
            {list.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">No hay modificadores aquí.</li>}
            {list.map((m) => {
              const on = selected.has(m.id);
              return (
                <li key={m.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        if (on) next.delete(m.id);
                        else next.add(m.id);
                        return next;
                      })
                    }
                    className={cn(
                      "flex min-w-0 flex-1 items-start gap-2 rounded-xl border p-2.5 text-left text-sm transition-colors",
                      on ? "border-primary bg-primary/10" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 line-clamp-3">{m.text}</span>
                  </button>
                  <button
                    type="button"
                    title="Editar (se guarda como uno nuevo)"
                    aria-label="Editar modificador"
                    onClick={() => setEditingMod(m)}
                    className="flex w-9 shrink-0 items-center justify-center rounded-xl border text-muted-foreground hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Button className="h-11" disabled={busy} onClick={save}>
        {busy && <Loader2 className="animate-spin" />} Guardar cambios
      </Button>

      <ModifierEditor
        open={!!editingMod}
        onOpenChange={(o) => !o && setEditingMod(null)}
        categories={categories}
        editing={editingMod}
        keepOriginal
        onSaved={async (created) => {
          const old = editingMod;
          const fresh = created?.[0];
          // La versión nueva ocupa el lugar de la original dentro del preset.
          if (old && fresh)
            setSelected((sel) => {
              const next = new Set(sel);
              if (next.delete(old.id)) next.add(fresh.id);
              return next;
            });
          await onSaved();
        }}
      />
    </>
  );
}
