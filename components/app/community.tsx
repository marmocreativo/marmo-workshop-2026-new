"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Play, Sparkles } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fileUrl } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { CommunityModifier, CommunityPreset, Generation } from "@/lib/types";
import { GenerationLightbox } from "./generation-lightbox";

// Lo que otros usuarios marcaron como público: resultados (con su prompt) y modificadores.
export function Community() {
  const [tab, setTab] = useState<"results" | "mods" | "presets">("results");
  const [presets, setPresets] = useState<CommunityPreset[] | null>(null);
  const [preset, setPreset] = useState<CommunityPreset | null>(null);
  const [savedPresets, setSavedPresets] = useState<Set<string>>(new Set());
  const [gens, setGens] = useState<Generation[] | null>(null);
  const [mods, setMods] = useState<CommunityModifier[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    api<{ generations: Generation[] }>("/api/community/generations")
      .then((r) => setGens(r.generations))
      .catch((e: Error) => (toast.error(e.message), setGens([])));
    api<{ modifiers: CommunityModifier[] }>("/api/community/modifiers")
      .then((r) => setMods(r.modifiers))
      .catch((e: Error) => (toast.error(e.message), setMods([])));
    api<{ presets: CommunityPreset[] }>("/api/community/presets")
      .then((r) => setPresets(r.presets))
      .catch((e: Error) => (toast.error(e.message), setPresets([])));
  }, []);

  async function savePreset(p: CommunityPreset) {
    try {
      await api(`/api/community/presets/${p.id}/clone`, { method: "POST" });
      setSavedPresets((s) => new Set(s).add(p.id));
      toast.success("Preset guardado en tu biblioteca");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const categories = useMemo(() => [...new Set((mods ?? []).map((m) => m.category))].sort(), [mods]);
  const shownMods = (mods ?? []).filter((m) => cat === "all" || m.category === cat);

  async function save(m: CommunityModifier) {
    try {
      const r = await api<{ existed: boolean }>(`/api/modifiers/${m.id}/clone`, { method: "POST" });
      setSaved((s) => new Set(s).add(m.id));
      toast.success(r.existed ? "Ya lo tenías en tu biblioteca" : "Guardado en tu biblioteca");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 lg:max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Comunidad</h1>
        <p className="text-sm text-muted-foreground">Resultados, modificadores y presets que otros usuarios decidieron compartir.</p>
      </header>

      <div className="grid max-w-md grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm font-medium">
        {(
          [
            ["results", "Resultados"],
            ["mods", "Modificadores"],
            ["presets", "Presets"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn("h-8 rounded-lg", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "presets" ? (
        <div className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 lg:grid-cols-5">
          {presets === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          {presets?.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Todavía no hay presets públicos. Comparte los tuyos desde la pestaña Presets de tu Biblioteca.
            </p>
          )}
          {presets?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p)}
              className="relative flex aspect-square items-end overflow-hidden rounded-2xl border bg-muted text-left"
            >
              {p.ref_file ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(p.ref_file)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              ) : (
                <Bookmark className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className="relative w-full p-3 text-white">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-white/70">
                  {p.modifiers.length} modificador{p.modifiers.length === 1 ? "" : "es"}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : tab === "results" ? (
        <div className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 lg:grid-cols-5">
          {gens === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}
          {gens?.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              Todavía no hay resultados públicos de otros usuarios.
            </p>
          )}
          {gens?.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setOpenId(g.id)}
              className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-muted"
            >
              {g.kind === "video" ? (
                <>
                  <video src={fileUrl(g.result_file!)} muted playsInline preload="metadata" className="size-full object-cover" />
                  <Play className="absolute top-2 right-2 size-5 fill-white text-white drop-shadow" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(g.result_file!)} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3 pb-4 lg:max-w-3xl">
          {categories.length > 0 && (
            <div className="relative max-w-sm">
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                aria-label="Categoría"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-base"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          {mods === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          {mods?.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Todavía no hay modificadores públicos. Comparte los tuyos desde tu Biblioteca.
            </p>
          )}
          <ul className="space-y-2">
            {shownMods.map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{m.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.category} · {m.usage_count} {m.usage_count === 1 ? "uso" : "usos"}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={saved.has(m.id)} onClick={() => save(m)}>
                  <BookmarkPlus /> {saved.has(m.id) ? "Guardado" : "Guardar"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!preset} onOpenChange={(o) => !o && setPreset(null)}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto">
          {preset && (
            <>
              <DialogHeader>
                <DialogTitle>{preset.name}</DialogTitle>
                <DialogDescription>Se copiará a tu biblioteca junto con sus modificadores.</DialogDescription>
              </DialogHeader>
              {preset.ref_file && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(preset.ref_file)} alt="" className="mx-auto aspect-square w-full max-w-xs rounded-2xl object-cover" />
              )}
              <ul className="space-y-1.5">
                {preset.modifiers.map((m, i) => (
                  <li key={i} className="rounded-xl bg-muted px-3 py-2 text-sm">
                    <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{m.category}</span>
                    {m.text}
                  </li>
                ))}
                {preset.free_text && <li className="rounded-xl border px-3 py-2 text-sm italic">{preset.free_text}</li>}
              </ul>
              <Button className="h-11" disabled={savedPresets.has(preset.id)} onClick={() => savePreset(preset)}>
                <BookmarkPlus /> {savedPresets.has(preset.id) ? "Guardado" : "Guardar en mis presets"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <GenerationLightbox
        items={gens ?? []}
        openId={openId}
        onOpenChange={setOpenId}
        onDelete={() => {}}
        readOnly
        footer={(g) => (
          <div className="flex flex-wrap gap-2">
            {g.kind === "image" && g.result_file && (
              <Link
                href={`/studio?ref=${encodeURIComponent(g.result_file)}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                <Sparkles className="size-4" /> Usar como referencia
              </Link>
            )}
            {g.source_file && (
              <Link
                href={`/studio?ref=${encodeURIComponent(g.source_file)}`}
                className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium"
              >
                Usar la foto original
              </Link>
            )}
          </div>
        )}
      />
    </div>
  );
}
