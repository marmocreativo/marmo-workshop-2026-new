"use client";

import { useState } from "react";
import { Bookmark, Plus, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileUrl } from "@/lib/client";
import { cn } from "@/lib/utils";
import { ModifierEditor } from "./modifier-editor";
import { ModifierBrowser } from "./modifier-picker";
import { PresetCards, PresetSaveDialog } from "./preset-cards";
import type { StudioState } from "./use-studio";

type Tab = "mods" | "presets" | "images";
const TABS: [Tab, string][] = [
  ["presets", "Presets"],
  ["mods", "Modificadores"],
  ["images", "Imágenes"],
];

// Biblioteca del Studio: modificadores, presets e imágenes usadas. Va en una columna (escritorio) o en un drawer (móvil).
export function LibraryPanel({ s, onClose, className }: { s: StudioState; onClose?: () => void; className?: string }) {
  const [tab, setTab] = useState<Tab>("presets");
  const [editorOpen, setEditorOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [trash, setTrash] = useState(false);

  const done = s.gens.filter((g) => g.result_file);
  // Imágenes ya usadas. Las referencias tienen borrado suave (papelera).
  const used = trash
    ? s.gens
        .filter((g) => g.source_file && g.source_deleted_at)
        .map((g) => ({ id: g.id, file: g.source_file!, kind: "Referencia", isRef: true }))
    : [
        ...s.gens
          .filter((g) => g.source_file && !g.source_deleted_at)
          .map((g) => ({ id: g.id, file: g.source_file!, kind: "Referencia", isRef: true })),
        ...done
          .filter((g) => g.kind === "image")
          .map((g) => ({ id: g.id, file: g.result_file!, kind: "Resultado", isRef: false })),
      ];
  const shown = used.slice(0, 90);
  const trashCount = s.gens.filter((g) => g.source_file && g.source_deleted_at).length;
  const canSavePreset = s.selected.size > 0 || s.freeText.trim().length > 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <header className="flex h-8 items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Biblioteca</h2>
        {tab === "mods" && (
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            <Plus /> Nuevo
          </Button>
        )}
        {tab === "presets" && (
          <Button variant="outline" size="sm" disabled={!canSavePreset} onClick={() => setSaveOpen(true)}>
            <Bookmark /> Guardar actual
          </Button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm font-medium">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn("h-8 rounded-lg px-1 text-[13px]", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mods" && (
        <ModifierBrowser focused categories={s.categories} modifiers={s.modifiers} selected={s.selected} onToggle={s.toggle} />
      )}

      {tab === "presets" && (
        <PresetCards
          presets={s.presets}
          onApply={(p) => {
            s.applyPreset(p);
            onClose?.();
          }}
          onDelete={s.deletePreset}
          onTogglePublic={(p) => s.setPresetPublic(p.id, !p.is_public)}
        />
      )}

      {tab === "images" && (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{trash ? "Referencias eliminadas" : "Referencias y resultados anteriores"}</span>
            {(trash || trashCount > 0) && (
              <button type="button" onClick={() => setTrash((t) => !t)} className="flex items-center gap-1 font-medium text-primary">
                {trash ? (
                  "Volver"
                ) : (
                  <>
                    <Trash2 className="size-3" /> Eliminadas ({trashCount})
                  </>
                )}
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {trash ? "La papelera está vacía." : "Aún no has usado imágenes."}
            </p>
          ) : (
            <ul className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto">
              {shown.map((u) => (
                <li key={`${u.isRef ? "s" : "r"}-${u.id}`} className="group relative">
                  <button
                    type="button"
                    title={trash ? u.kind : `${u.kind}: usar como foto a editar`}
                    disabled={trash}
                    onClick={() => {
                      s.useStoredFile(u.file);
                      onClose?.();
                    }}
                    className="relative block aspect-square w-full overflow-hidden rounded-xl border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(u.file)} alt="" loading="lazy" className={cn("size-full object-cover", trash && "opacity-60")} />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {u.kind}
                    </span>
                  </button>
                  {u.isRef && (
                    <button
                      type="button"
                      aria-label={trash ? "Restaurar imagen" : "Quitar de la biblioteca"}
                      title={trash ? "Restaurar" : "Quitar de la biblioteca"}
                      onClick={() => s.setSourceDeleted(u.id, !trash)}
                      className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
                    >
                      {trash ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ModifierEditor open={editorOpen} onOpenChange={setEditorOpen} categories={s.categories} onSaved={s.applyCreated} appliesOnScan />
      <PresetSaveDialog open={saveOpen} onOpenChange={setSaveOpen} hasImage={!!s.image} onSave={s.savePreset} />
    </div>
  );
}
