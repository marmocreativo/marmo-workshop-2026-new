"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Play } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fileUrl, jsonBody } from "@/lib/client";
import type { Generation, Modifier } from "@/lib/types";
import { Chip, ChipRow } from "./chip";
import { GenerationLightbox } from "./generation-lightbox";

export function Gallery({ initialModifierId }: { initialModifierId?: string }) {
  const [modifierId, setModifierId] = useState<string | null>(initialModifierId ?? null);
  const [gens, setGens] = useState<Generation[]>([]);
  const [used, setUsed] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api<{ modifiers: Modifier[] }>("/api/modifiers")
      .then((r) => setUsed(r.modifiers.filter((m) => m.usage_count > 0).sort((a, b) => b.usage_count - a.usage_count)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api<{ generations: Generation[] }>(`/api/generations${modifierId ? `?modifierId=${modifierId}` : ""}`)
      .then((r) => setGens(r.generations))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [modifierId]);

  const active = useMemo(() => used.find((m) => m.id === modifierId), [used, modifierId]);

  async function remove(id: string) {
    try {
      await api(`/api/generations/${id}`, { method: "DELETE" });
      setGens((all) => all.filter((g) => g.id !== id));
      toast.success("Resultado eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 lg:max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Galería</h1>
        <p className="text-sm text-muted-foreground">
          {active ? `Resultados con “${active.text}”` : "Filtra por modificador para ver qué resultados genera."}
        </p>
      </header>

      {used.length > 0 && (
        <ChipRow>
          <Chip active={!modifierId} onClick={() => setModifierId(null)}>Todas</Chip>
          {used.map((m) => (
            <Chip key={m.id} active={modifierId === m.id} onClick={() => setModifierId(m.id)} className="max-w-56">
              <span className="truncate">{m.text}</span>
              <span className="text-xs opacity-70">{m.usage_count}</span>
            </Chip>
          ))}
        </ChipRow>
      )}

      <div className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}
        {!loading && gens.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
            Aún no hay resultados. Genera tu primera imagen en el Studio.
          </p>
        )}
        {gens.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setOpenId(g.id)}
            className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-muted"
          >
            {g.result_file ? (
              g.kind === "video" ? (
                <>
                  <video src={fileUrl(g.result_file)} muted playsInline preload="metadata" className="size-full object-cover" />
                  <Play className="absolute top-2 right-2 size-5 fill-white text-white drop-shadow" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(g.result_file)} alt="" loading="lazy" className="size-full object-cover" />
              )
            ) : (
              <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground">
                <AlertCircle className="size-5" />
                {g.status === "error" ? "Falló" : "Procesando"}
              </span>
            )}
          </button>
        ))}
      </div>

      <GenerationLightbox
        items={gens}
        openId={openId}
        onOpenChange={setOpenId}
        onDelete={remove}
        onSavePreset={async (x, name) => {
          const form = new FormData();
          form.set("name", name);
          form.set("generationId", x.id);
          await api("/api/presets", { method: "POST", body: form });
          toast.success("Preset guardado");
        }}
        onVisibility={async (g, patch) => {
          setGens((all) =>
            all.map((x) =>
              x.id === g.id
                ? {
                    ...x,
                    is_public: patch.isPublic === undefined ? x.is_public : +patch.isPublic,
                    source_public: patch.sourcePublic === undefined ? x.source_public : +patch.sourcePublic,
                  }
                : x,
            ),
          );
          try {
            await api(`/api/generations/${g.id}`, { method: "PATCH", body: jsonBody(patch) });
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
        onModifierClick={(id) => {
          setModifierId(id);
          setOpenId(null);
        }}
      />
    </div>
  );
}
