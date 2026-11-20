"use client";

import { useState } from "react";
import { Images, Layers } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GalleryPanel } from "./gallery-panel";
import { GenerationLightbox } from "./generation-lightbox";
import { LibraryPanel } from "./library-panel";
import { StudioCanvas } from "./studio-canvas";
import type { StudioState } from "./use-studio";

// Móvil: el mismo lienzo que en escritorio; biblioteca y resultados viven en drawers laterales.
export function StudioMobile({ s }: { s: StudioState }) {
  const [libOpen, setLibOpen] = useState(false);
  const [galOpen, setGalOpen] = useState(false);
  // Hay foto pero ningún modificador: el botón de la biblioteca pulsa para guiar al usuario.
  const needsMods = !!s.image && s.selected.size === 0;

  const fab = "flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/80";

  return (
    <div className="h-[calc(100dvh-8.75rem)]">
      <StudioCanvas
        s={s}
        corner={
          <>
            <button type="button" aria-label="Abrir biblioteca" onClick={() => setLibOpen(true)} className={cn(fab, "relative")}>
              {needsMods && <span className="absolute inset-0 animate-ping rounded-full bg-primary/70" />}
              <span
                className={cn(
                  "relative flex size-full items-center justify-center rounded-full",
                  needsMods && "bg-primary ring-2 ring-white",
                )}
              >
                <Layers className="size-5" />
              </span>
            </button>
            <button type="button" aria-label="Abrir resultados" onClick={() => setGalOpen(true)} className={cn(fab, "relative")}>
              {s.fresh.size > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-primary/70" />}
              <span
                className={cn(
                  "relative flex size-full items-center justify-center rounded-full",
                  s.fresh.size > 0 && "bg-primary ring-2 ring-white",
                )}
              >
                <Images className="size-5" />
              </span>
            </button>
          </>
        }
      />

      <Sheet open={libOpen} onOpenChange={setLibOpen}>
        <SheetContent side="left" className="gap-0 p-4 data-[side=left]:w-[92%] data-[side=left]:sm:max-w-md">
          <SheetTitle className="sr-only">Biblioteca</SheetTitle>
          <SheetDescription className="sr-only">Modificadores, presets e imágenes.</SheetDescription>
          <LibraryPanel s={s} onClose={() => setLibOpen(false)} className="pr-8" />
        </SheetContent>
      </Sheet>

      <Sheet open={galOpen} onOpenChange={setGalOpen}>
        <SheetContent side="right" className="gap-0 p-4 data-[side=right]:w-[92%] data-[side=right]:sm:max-w-md">
          <SheetTitle className="sr-only">Resultados</SheetTitle>
          <SheetDescription className="sr-only">Tus resultados generados.</SheetDescription>
          <GalleryPanel s={s} onOpen={() => setGalOpen(false)} />
        </SheetContent>
      </Sheet>

      <GenerationLightbox
        items={s.gens}
        openId={s.openId}
        onOpenChange={s.setOpenId}
        onDelete={s.deleteGen}
        onReuse={s.reuse}
        onSavePreset={(g, name) => s.savePresetFromGeneration(g.id, name)}
        onVisibility={s.setVisibility}
      />
    </div>
  );
}
