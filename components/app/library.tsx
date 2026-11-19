"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Globe, Images, Lock, Pencil, Plus, ScanSearch, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fileUrl, jsonBody } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Modifier } from "@/lib/types";
import { CategorySelect } from "./category-select";
import { ModifierEditor } from "./modifier-editor";
import { useLibrary } from "./use-library";

export function Library() {
  const { categories, modifiers, loading, refresh, setModifiers } = useLibrary();
  const [tab, setTab] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Modifier | null>(null);
  const [newCat, setNewCat] = useState<string | null>(null);

  const list = useMemo(() => {
    const filtered = modifiers.filter((m) =>
      tab === "all" || tab === "new" ? true : tab === "favs" ? m.favorite === 1 : m.category_id === tab,
    );
    return tab === "new" ? [...filtered].sort((a, b) => b.created_at - a.created_at) : filtered;
  }, [modifiers, tab]);

  async function toggleFav(m: Modifier) {
    const next = m.favorite ? 0 : 1;
    setModifiers((all) => all.map((x) => (x.id === m.id ? { ...x, favorite: next } : x)));
    try {
      await api(`/api/modifiers/${m.id}`, { method: "PATCH", body: jsonBody({ favorite: !!next }) });
    } catch (e) {
      toast.error((e as Error).message);
      refresh();
    }
  }

  async function togglePublic(m: Modifier) {
    const next = m.is_public ? 0 : 1;
    setModifiers((all) => all.map((x) => (x.id === m.id ? { ...x, is_public: next } : x)));
    try {
      await api(`/api/modifiers/${m.id}`, { method: "PATCH", body: jsonBody({ isPublic: !!next }) });
      toast.success(next ? "Ahora es público: otros usuarios pueden guardarlo" : "Ahora es privado");
    } catch (e) {
      toast.error((e as Error).message);
      refresh();
    }
  }

  async function remove(m: Modifier) {
    if (!confirm("¿Quitar este modificador de tu biblioteca? Tus resultados anteriores conservan su registro.")) return;
    try {
      await api(`/api/modifiers/${m.id}`, { method: "DELETE" });
      setModifiers((all) => all.filter((x) => x.id !== m.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addCategory() {
    if (!newCat?.trim()) return setNewCat(null);
    try {
      await api("/api/categories", { method: "POST", body: jsonBody({ name: newCat }) });
      setNewCat(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 lg:max-w-3xl">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">{modifiers.length} modificadores</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus /> Nuevo
        </Button>
      </header>

      <div className="flex gap-2">
        {newCat === null ? (
          <>
            <CategorySelect
              className="flex-1"
              value={tab}
              onChange={setTab}
              categories={categories}
              extra={[
                { value: "all", label: "Todos" },
                { value: "new", label: "Más nuevos" },
                { value: "favs", label: "★ Favoritos" },
              ]}
            />
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setNewCat("")}>
              <Plus /> Categoría
            </Button>
          </>
        ) : (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCategory();
            }}
          >
            <Input
              autoFocus
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Nombre de la categoría"
              className="h-10 flex-1 rounded-xl text-base"
            />
            <Button type="submit" className="h-10 rounded-xl">Crear</Button>
            <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={() => setNewCat(null)}>
              Cancelar
            </Button>
          </form>
        )}
      </div>

      <ul className="space-y-2 pb-4">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        {!loading && list.length === 0 && (
          <li className="py-12 text-center text-sm text-muted-foreground">No hay modificadores en esta vista.</li>
        )}
        {list.map((m) => (
          <li key={m.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-sm">{m.text}</p>
              <button
                type="button"
                aria-label="Favorito"
                onClick={() => toggleFav(m)}
                className="-m-1 p-1"
              >
                <Star className={cn("size-5", m.favorite ? "fill-accent text-accent" : "text-muted-foreground")} />
              </button>
            </div>
            {(m.origin_file || (m.thumbs?.length ?? 0) > 0) && (
              <div className="mt-3 flex items-center gap-2">
                {m.origin_file && (
                  <a
                    href={fileUrl(m.origin_file)}
                    target="_blank"
                    rel="noreferrer"
                    title="Imagen de la que salió este modificador (abrir)"
                    className="relative block size-14 shrink-0 overflow-hidden rounded-xl ring-2 ring-primary/60"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(m.origin_file)} alt="Imagen de origen" loading="lazy" className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/70 py-0.5 text-[9px] font-medium text-white">
                      <ScanSearch className="size-2.5" /> Origen
                    </span>
                  </a>
                )}
                {(m.thumbs?.length ?? 0) > 0 && (
                  <>
                    {m.origin_file && <span className="h-8 w-px bg-border" />}
                    <ul className="flex gap-1.5 overflow-hidden">
                      {m.thumbs!.map((f) => (
                        <li key={f}>
                          <Link
                            href={`/galeria?modifier=${m.id}`}
                            title="Ver resultados con este modificador"
                            className="block size-14 overflow-hidden rounded-xl border bg-muted"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileUrl(f)} alt="Resultado" loading="lazy" className="size-full object-cover" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {categories.find((c) => c.id === m.category_id)?.name} · {m.usage_count}{" "}
                {m.usage_count === 1 ? "uso" : "usos"}
                {m.parent_id && " · editado"}
                {m.is_public === 1 && " · público"}
              </span>
              <span className="flex items-center gap-1">
                {m.usage_count > 0 && (
                  <Link
                    href={`/galeria?modifier=${m.id}`}
                    className="flex h-8 items-center gap-1 rounded-md px-2 hover:bg-muted"
                  >
                    <Images className="size-3.5" /> Resultados
                  </Link>
                )}
                <button
                  type="button"
                  aria-label={m.is_public ? "Hacer privado" : "Hacer público"}
                  title={m.is_public ? "Público: clic para hacerlo privado" : "Privado: clic para compartirlo"}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md hover:bg-muted",
                    m.is_public && "text-primary",
                  )}
                  onClick={() => togglePublic(m)}
                >
                  {m.is_public ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                </button>
                <button
                  type="button"
                  aria-label="Editar"
                  className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  onClick={() => {
                    setEditing(m);
                    setEditorOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Quitar"
                  className="flex size-8 items-center justify-center rounded-md text-destructive hover:bg-muted"
                  onClick={() => remove(m)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <ModifierEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        categories={categories}
        defaultCategoryId={categories.some((c) => c.id === tab) ? tab : undefined}
        editing={editing}
        onSaved={refresh}
      />
    </div>
  );
}
