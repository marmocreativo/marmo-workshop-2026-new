"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
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
import type { Category, Modifier, Preset } from "@/lib/types";
import { CategorySelect } from "./category-select";

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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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

function PresetForm({
  preset,
  onOpenChange,
  categories,
  modifiers,
  onSaved,
}: Props & { preset: Preset }) {
  const [name, setName] = useState(preset.name);
  const [freeText, setFreeText] = useState(preset.free_text ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(preset.modifier_ids),
  );
  const [cat, setCat] = useState("all");
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
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
      form.set("modifierIds", JSON.stringify([...selected]));
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
      <div className="flex items-center gap-3">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
          {shownCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownCover}
              alt="Portada"
              className="size-full object-cover"
            />
          ) : (
            <Bookmark className="size-8 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickCover(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus /> {shownCover ? "Cambiar portada" : "Agregar portada"}
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
              <Trash2 /> Quitar portada
            </Button>
          )}
        </div>
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="Nombre del preset"
        className="h-11 text-base"
      />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Prompt manual</label>
        <Textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Describe modificaciones extra"
          className="text-base"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Modificadores</label>
          <span className="text-xs text-muted-foreground">
            {selected.size} elegidos
          </span>
        </div>
        <CategorySelect
          value={cat}
          onChange={setCat}
          categories={categories}
          extra={[{ value: "all", label: "Todas las categorías" }]}
        />
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {list.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">
              No hay modificadores aquí.
            </li>
          )}
          {list.map((m) => {
            const on = selected.has(m.id);
            return (
              <li key={m.id}>
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
                    "flex w-full items-start gap-2 rounded-xl border p-2.5 text-left text-sm transition-colors",
                    on ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 line-clamp-3">{m.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Button className="h-11" disabled={busy} onClick={save}>
        {busy && <Loader2 className="animate-spin" />} Guardar cambios
      </Button>
    </>
  );
}
