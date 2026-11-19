"use client";

import { useSyncExternalStore } from "react";
import { StudioDesktop } from "./studio-desktop";
import { StudioMobile } from "./studio-mobile";
import { useStudio } from "./use-studio";

const QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

// Móvil: flujo vertical. Escritorio (≥1024px): tres columnas (biblioteca · modelo · galería).
export function Studio({ initialRef }: { initialRef?: string }) {
  const s = useStudio(initialRef);
  const isDesktop = useIsDesktop();
  return isDesktop ? <StudioDesktop s={s} /> : <StudioMobile s={s} />;
}
