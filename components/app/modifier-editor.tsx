"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardPaste, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { requestBalanceRefresh } from "@/lib/balance";
import { api, jsonBody, resizeImage } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Category, Modifier } from "@/lib/types";
import { CategorySelect } from "./category-select";

type Suggestion = { categoryId: string; text: string; selected: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  defaultCategoryId?: string;
  editing?: Modifier | null;
  /** Recibe los modificadores creados al guardar el análisis de una imagen. */
  onSaved: (created?: Modifier[], opts?: { replace?: boolean }) => void | Promise<void>;
  /** Si el contexto aplica de inmediato lo guardado (p. ej. el Studio), el aviso lo indica. */
  appliesOnScan?: boolean;
  /** Modificadores ya elegidos en el Studio: si hay, al aplicar un análisis se pregunta si agregar o reemplazar. */
  selectedCount?: number;
  /** Al editar, el original queda intacto en la biblioteca (solo se crea uno nuevo). */
  keepOriginal?: boolean;
  /** Pestaña con la que abre el diálogo (por defecto, escribir). */
  initialMode?: "write" | "analyze";
};

export function ModifierEditor({
  open,
  onOpenChange,
  categories,
  defaultCategoryId,
  editing,
  onSaved,
  appliesOnScan,
  selectedCount = 0,
  keepOriginal,
  initialMode = "write",
}: Props) {
  const [mode, setMode] = useState<"write" | "analyze">("write");
  const [categoryId, setCategoryId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const originRef = useRef<File | null>(null);
  const [analysisTokens, setAnalysisTokens] = useState<number | null>(null);
  const [originUrl, setOriginUrl] = useState<string | null>(null);
  const [applyMode, setApplyMode] = useState<"add" | "replace">("add");

  // Vista previa de la imagen que se está analizando.
  function showOrigin(file: File | null) {
    setOriginUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  }
  useEffect(() => () => showOrigin(null), []);

  // Muestra el costo del análisis la primera vez que se abre esa pestaña.
  useEffect(() => {
    if (!open || mode !== "analyze" || analysisTokens !== null) return;
    api<{ pricing: { analysisTokens: number }; account: { bypass: boolean } }>("/api/billing/me")
      .then((r) => setAnalysisTokens(r.account.bypass ? 0 : r.pricing.analysisTokens))
      .catch(() => {});
  }, [open, mode, analysisTokens]);

  useEffect(() => {
    if (!open) return;
    originRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    showOrigin(null);
    setMode(initialMode);
    setSuggestions([]);
    setApplyMode("add");
    setText(editing?.text ?? "");
    setCategoryId(editing?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
  }, [open, editing, defaultCategoryId, categories, initialMode]);

  // En modo "Analizar imagen", Ctrl/Cmd+V analiza la imagen del portapapeles.
  useEffect(() => {
    if (!open || mode !== "analyze") return;
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f && !busy) analyze(f);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, busy]);

  async function pasteButton() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) return analyze(new File([await item.getType(type)], "pegada.png", { type }));
      }
      toast.error("No hay ninguna imagen en el portapapeles");
    } catch {
      toast.error("No pude leer el portapapeles. Prueba con Ctrl+V.");
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        const r = await api<{ modifier: Modifier }>(`/api/modifiers/${editing.id}`, {
          method: "PATCH",
          body: jsonBody({ text, categoryId, keepOriginal }),
        });
        toast.success("Guardado como un modificador nuevo");
        await onSaved([r.modifier]);
        onOpenChange(false);
        return;
      } else {
        await api("/api/modifiers", { method: "POST", body: jsonBody({ items: [{ categoryId, text }] }) });
        toast.success("Modificador creado");
      }
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function analyze(file: File) {
    setBusy(true);
    setSuggestions([]);
    try {
      const form = new FormData();
      const small = await resizeImage(file, 1280);
      originRef.current = small; // se sube al guardar, como "origen" de los modificadores
      showOrigin(small);
      form.set("image", small);
      const { suggestions: s } = await api<{ suggestions: { categoryId: string; text: string }[] }>("/api/analyze", {
        method: "POST",
        body: form,
      });
      if (!s.length) toast.message("No encontré nada que describir en esa imagen");
      setSuggestions(s.map((x) => ({ ...x, selected: true })));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      requestBalanceRefresh(); // el análisis cuesta tokens
    }
  }

  async function saveSuggestions() {
    const selected = suggestions.filter((s) => s.selected);
    if (!selected.length) return;
    setBusy(true);
    try {
      let originFile: string | undefined;
      if (originRef.current) {
        const form = new FormData();
        form.set("image", originRef.current);
        originFile = (await api<{ originFile: string }>("/api/modifiers/origin", { method: "POST", body: form })).originFile;
      }
      const replace = appliesOnScan && selectedCount > 0 && applyMode === "replace";
      const items = selected.map(({ categoryId, text }) => ({ categoryId, text, originFile }));
      const { modifiers: created } = await api<{ modifiers: Modifier[] }>("/api/modifiers", {
        method: "POST",
        body: jsonBody({ items }),
      });
      const many = items.length > 1;
      toast.success(
        `${items.length} modificador${many ? "es" : ""} guardado${many ? "s" : ""}${
          appliesOnScan ? (replace ? ` y aplicado${many ? "s" : ""} en lugar de los anteriores` : ` y agregado${many ? "s" : ""} a tu foto`) : ""
        }`,
      );
      await onSaved(created, { replace });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar modificador" : "Nuevo modificador"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Al guardar se crea un registro nuevo; el original no se modifica."
              : "Escríbelo a mano o deja que Gemini lo describa desde una foto."}
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium">
            {(["write", "analyze"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("h-9 rounded-md", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {m === "write" ? "Escribir" : "Analizar imagen"}
              </button>
            ))}
          </div>
        )}

        {mode === "write" ? (
          <div className="space-y-3">
            <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej. Luz de neón en tonos magenta y azul"
              rows={6}
              maxLength={2000}
              className="text-base"
              autoFocus
            />
            <p className="text-right text-xs text-muted-foreground">{text.length}/2000</p>
            <Button className="h-11 w-full" disabled={busy || !text.trim() || !categoryId} onClick={save}>
              {busy && <Loader2 className="animate-spin" />}
              {editing ? "Guardar como nuevo" : "Guardar modificador"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyze(f);
                e.target.value = "";
              }}
            />
            {originUrl && (
              <div className="relative overflow-hidden rounded-2xl border bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={originUrl} alt="Imagen analizada" className="mx-auto max-h-64 w-auto object-contain" />
                {busy && <div className="absolute inset-0 animate-pulse bg-primary/20" />}
              </div>
            )}
            {busy ? (
              <Button variant="outline" className="h-11 w-full" disabled>
                <Loader2 className="animate-spin" /> Analizando con Gemini…
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> Elegir imagen
                </Button>
                <Button variant="outline" className="h-11" onClick={pasteButton}>
                  <ClipboardPaste /> Pegar
                </Button>
              </div>
            )}
            {!busy && suggestions.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                También puedes pegar con Ctrl+V.
                {analysisTokens != null && analysisTokens > 0 && ` Cada análisis cuesta ${analysisTokens} ${analysisTokens === 1 ? "token" : "tokens"}.`}
              </p>
            )}

            {suggestions.length > 0 && (
              <>
                <ul className="space-y-2">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() =>
                          setSuggestions((all) => all.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))
                        }
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-3 text-left",
                          s.selected ? "border-primary bg-primary/5" : "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                            s.selected && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {s.selected && <Check className="size-3" />}
                        </span>
                        <span>
                          <span className="block text-xs font-medium text-muted-foreground">{catName(s.categoryId)}</span>
                          <span className="text-sm">{s.text}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {appliesOnScan && selectedCount > 0 && (
                  <div role="radiogroup" aria-label="Qué hacer con los modificadores actuales" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium">
                    {(
                      [
                        ["add", `Agregar a los ${selectedCount} actuales`],
                        ["replace", "Reemplazar los actuales"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={applyMode === v}
                        onClick={() => setApplyMode(v)}
                        className={cn("min-h-9 rounded-md px-2 py-1 leading-tight", applyMode === v ? "bg-background shadow-sm" : "text-muted-foreground")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <Button className="h-11 w-full" disabled={busy || !suggestions.some((s) => s.selected)} onClick={saveSuggestions}>
                  <Sparkles />
                  Guardar {suggestions.filter((s) => s.selected).length} seleccionados
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
