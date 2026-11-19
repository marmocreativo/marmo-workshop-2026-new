"use client";

import { Play, Sparkles } from "lucide-react";
import { fileUrl } from "@/lib/client";
import type { StudioState } from "./use-studio";

// Resultados del Studio: columna en escritorio, drawer en móvil.
export function GalleryPanel({ s, onOpen }: { s: StudioState; onOpen?: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex h-8 items-center">
        <h2 className="text-lg font-semibold tracking-tight">Galería</h2>
      </header>
      <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
        {s.busy && (
          <li className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground">
            <Sparkles className="size-7 animate-pulse text-primary" />
            Generando…
          </li>
        )}
        {s.gens.length === 0 && !s.busy && (
          <li className="col-span-2 py-16 text-center text-sm text-muted-foreground">Tus resultados aparecerán aquí.</li>
        )}
        {s.gens.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => {
                onOpen?.();
                s.setOpenId(g.id);
              }}
              className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-muted transition-transform hover:scale-[1.01]"
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
                <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  {g.status === "error" ? "Falló" : "Procesando"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
