"use client";

import { GalleryPanel } from "./gallery-panel";
import { GenerationLightbox } from "./generation-lightbox";
import { LibraryPanel } from "./library-panel";
import { ModeSwitcher } from "./mode-switcher";
import { StudioCanvas } from "./studio-canvas";
import type { StudioState } from "./use-studio";

const RESULT_HINT = "¡Tu resultado! Ciérralo para seguir.";
const panel = "flex min-h-0 flex-col rounded-3xl border bg-card p-4";

export function StudioDesktop({ s }: { s: StudioState }) {
  return (
    <div className="flex h-[calc(100dvh-2.5rem)] flex-col gap-3">
    <ModeSwitcher s={s} />
    <div className="grid min-h-0 flex-1 grid-cols-[21rem_minmax(0,1fr)_22rem] gap-4 xl:grid-cols-[24rem_minmax(0,1fr)_28rem]">
      <section className={panel} data-tour="library">
        <LibraryPanel s={s} />
      </section>
      <StudioCanvas s={s} />
      <section className={panel} data-tour="gallery">
        <GalleryPanel s={s} />
      </section>
      <GenerationLightbox
        items={s.gens}
        openId={s.openId}
        onOpenChange={s.setOpenId}
        onDelete={s.deleteGen}
        onReuse={s.reuse}
        onSavePreset={(g, name) => s.savePresetFromGeneration(g.id, name)}
        onVisibility={s.setVisibility}
        banner={s.tour.step === "result" ? RESULT_HINT : undefined}
      />
    </div>
    </div>
  );
}
