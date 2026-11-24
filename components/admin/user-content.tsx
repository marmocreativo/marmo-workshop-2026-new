"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fileUrl } from "@/lib/client";

export type ContentTab = "generations" | "modifiers" | "presets";
type Counts = { generations: number; modifiers: number; presets: number };

type Gen = {
  id: string;
  model: string;
  kind: "image" | "video";
  status: string;
  error: string | null;
  free_text: string | null;
  prompt: string;
  source_file: string | null;
  result_file: string | null;
  aspect_ratio: string | null;
  tokens_spent: number | null;
  is_public: number;
  created_at: number;
  modifiers: string[];
};
type Mod = { id: string; text: string; category: string; usage_count: number; favorite: number; is_public: number; origin_file: string | null; created_at: number };
type Pre = {
  id: string;
  name: string;
  free_text: string | null;
  instructions: string | null;
  ref_file: string | null;
  materials: string[];
  modifiers: string[];
  is_public: number;
  created_at: number;
};

const date = (n: number) => new Date(n).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

// Las imágenes se abren en grande en otra pestaña (el administrador puede ver archivos de cualquier usuario).
function Thumb({ file, label, video }: { file: string | null; label: string; video?: boolean }) {
  if (!file)
    return <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed text-[11px] text-muted-foreground">Sin {label}</div>;
  return (
    <a href={fileUrl(file)} target="_blank" rel="noreferrer" title={`Ver ${label}`} className="relative block aspect-square overflow-hidden rounded-xl border bg-muted">
      {video ? (
        <span className="flex size-full items-center justify-center">
          <Video className="size-6 text-muted-foreground" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(file)} alt={label} loading="lazy" className="size-full object-cover" />
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{label}</span>
    </a>
  );
}

export function UserContent({ userId, tab, onCounts }: { userId: string; tab: ContentTab; onCounts: (c: Counts) => void }) {
  const [items, setItems] = useState<unknown[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      if (offset) setBusy(true);
      try {
        const r = await api<{ counts: Counts; items: unknown[]; more: boolean }>(`/api/admin/users/${userId}/content?type=${tab}&offset=${offset}`);
        onCounts(r.counts);
        setItems((old) => (offset ? [...(old ?? []), ...r.items] : r.items));
        setMore(r.more);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [userId, tab, onCounts],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(0);
  }, [load]);

  if (!items) return <Skeleton className="h-48 rounded-2xl" />;
  if (!items.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nada por aquí todavía.</p>;

  return (
    <div className="space-y-3">
      {tab === "generations" && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(items as Gen[]).map((g) => (
            <li key={g.id} className="space-y-2 rounded-2xl border p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Thumb file={g.source_file} label="referencia" />
                <Thumb file={g.result_file} label="resultado" video={g.kind === "video"} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant={g.status === "done" ? "secondary" : "default"}>{g.status === "done" ? "Listo" : g.status === "error" ? "Error" : "Procesando"}</Badge>
                <span>{g.model}</span>
                {g.aspect_ratio && g.aspect_ratio !== "auto" && <span>· {g.aspect_ratio}</span>}
                {g.tokens_spent ? <span>· {g.tokens_spent} tokens</span> : null}
                {g.is_public ? <span>· pública</span> : null}
                <span className="ml-auto">{date(g.created_at)}</span>
              </div>
              {g.error && <p className="text-xs text-destructive">{g.error}</p>}
              {g.modifiers.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-xs">
                  {g.modifiers.map((m, i) => (
                    <li key={i} className="line-clamp-2">{m}</li>
                  ))}
                </ul>
              )}
              {g.free_text && <p className="text-xs italic text-muted-foreground">“{g.free_text}”</p>}
            </li>
          ))}
        </ul>
      )}

      {tab === "modifiers" && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(items as Mod[]).map((m) => (
            <li key={m.id} className="flex gap-3 rounded-2xl border p-3 text-sm">
              {m.origin_file && (
                <div className="w-14 shrink-0">
                  <Thumb file={m.origin_file} label="origen" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-primary">{m.category}</p>
                <p className="text-sm">{m.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {m.usage_count} usos{m.favorite ? " · favorito" : ""}{m.is_public ? " · público" : ""} · {date(m.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "presets" && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(items as Pre[]).map((p) => (
            <li key={p.id} className="space-y-2 rounded-2xl border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{p.name}</p>
                {p.is_public ? <Badge variant="secondary">Público</Badge> : null}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Thumb file={p.ref_file} label="portada" />
                {p.materials.map((f, i) => (
                  <Thumb key={f} file={f} label={`material ${i + 1}`} />
                ))}
              </div>
              {p.modifiers.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-xs">
                  {p.modifiers.map((m, i) => (
                    <li key={i} className="line-clamp-2">{m}</li>
                  ))}
                </ul>
              )}
              {p.free_text && <p className="text-xs"><span className="font-medium">Prompt:</span> {p.free_text}</p>}
              {p.instructions && <p className="text-xs"><span className="font-medium">Instrucciones:</span> {p.instructions}</p>}
              <p className="text-[11px] text-muted-foreground">{date(p.created_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {more && (
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => load(items.length)}>
          {busy && <Loader2 className="animate-spin" />} Cargar más
        </Button>
      )}
    </div>
  );
}
