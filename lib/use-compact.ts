"use client";

import { useSyncExternalStore } from "react";

// Pantallas muy pequeñas (celulares de baja resolución o con letra grande): la interfaz reduce sus textos.
const QUERY = "(max-width: 380px), (max-height: 640px)";

export function useCompact() {
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
