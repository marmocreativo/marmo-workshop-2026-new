"use client";

import { useEffect, useState } from "react";
import { Bookmark, PenLine, ScanLine, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, fileUrl } from "@/lib/client";
import type { CommunityPreset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ModifierEditor } from "./modifier-editor";
import { ModifierBrowser } from "./modifier-picker";
import { CommunityPresetCards, PresetCards, PresetSaveDialog } from "./preset-cards";
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
  const [editorMode, setEditorMode] = useState<"write" | "analyze">("write");
  const openEditor = (m: "write" | "analyze") => {
    setEditorMode(m);
    setEditorOpen(true);
  };
  const [saveOpen, setSaveOpen] = useState(false);
  const [trash, setTrash] = useState(false);
  const [community, setCommunity] = useState<CommunityPreset[]>([]);

  // Presets públicos de la comunidad, para empezar sin tener que armar nada.
  useEffect(() => {
    api<{ presets: CommunityPreset[] }>("/api/community/presets")
      .then((r) => setCommunity(r.presets.slice(0, 24)))
      .catch(() => {});
  }, []);

  const done = s.gens.filter((g) => g.result_file);
  // Imágenes ya usadas. Las referencias tienen borrado suave (papelera).
  // Cada archivo aparece una sola vez (varias generaciones pueden compartir la misma referencia).
  const refs = new Map<string, { id: string; file: string; kind: string; isRef: boolean; alive: boolean }>();
  for (const g of s.gens) {
    if (!g.source_file) continue;
    const alive = !g.source_deleted_at;
    const prev = refs.get(g.source_file);
    if (!prev) refs.set(g.source_file, { id: g.id, file: g.source_file, kind: "Referencia", isRef: true, alive });
    else if (alive && !prev.alive) refs.set(g.source_file, { ...prev, id: g.id, alive });
  }
  const results = new Map<string, { id: string; file: string; kind: string; isRef: boolean; alive: boolean }>();
  for (const g of done) if (g.kind === "image" && !refs.has(g.result_file!) && !results.has(g.result_file!)) results.set(g.result_file!, { id: g.id, file: g.result_file!, kind: "Resultado", isRef: false, alive: true });
  const used = trash ? [...refs.values()].filter((r) => !r.alive) : [...[...refs.values()].filter((r) => r.alive), ...results.values()];
  const shown = used.slice(0, 90);
  const trashCount = [...refs.values()].filter((r) => !r.alive).length;
  const canSavePreset = s.selected.size > 0 || s.freeText.trim().length > 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <header className="flex h-8 items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Biblioteca</h2>
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
        <>
          {/* La lista termina antes del fondo: abajo quedan fijos los accesos para crear modificadores. */}
          <ModifierBrowser focused categories={s.categories} modifiers={s.modifiers} selected={s.selected} onToggle={s.toggle} />
          <div className="grid shrink-0 grid-cols-2 gap-2 border-t pt-3">
            <button
              type="button"
              onClick={() => openEditor("write")}
              className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-muted px-2 text-center text-sm leading-tight font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <PenLine className="size-6" />
              Escribir un nuevo modificador
            </button>
            <button
              type="button"
              onClick={() => openEditor("analyze")}
              className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-muted px-2 text-center text-sm leading-tight font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <ScanLine className="size-6" />
              Analizar imagen y obtén modificadores
            </button>
          </div>
        </>
      )}

      {tab === "presets" && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
          {s.tour.step === "preset" && (
            <p className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              {community.length > 0 || s.presets.length > 0
                ? "Toca un preset (por ejemplo, uno de la comunidad) para aplicarlo a tu foto."
                : "Aún no hay presets: ve a la pestaña Modificadores y elige uno."}
            </p>
          )}
          <PresetCards
            presets={s.presets}
            onApply={(p) => {
              s.applyPreset(p);
              onClose?.();
            }}
            onDelete={s.deletePreset}
            onTogglePublic={(p) => s.setPresetPublic(p.id, !p.is_public)}
          />
          {community.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">De la comunidad</h3>
              <CommunityPresetCards
                presets={community}
                onUse={async (p) => {
                  await s.applyCommunityPreset(p);
                  onClose?.();
                }}
              />
            </section>
          )}
        </div>
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

      <ModifierEditor open={editorOpen} onOpenChange={setEditorOpen} initialMode={editorMode} categories={s.categories} onSaved={s.applyCreated} appliesOnScan selectedCount={s.selected.size} />
      <PresetSaveDialog open={saveOpen} onOpenChange={setSaveOpen} hasImage={!!s.image} materialCount={s.materials.length} onSave={s.savePreset} />
    </div>
  );
}
