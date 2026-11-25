"use client";

import { useEffect, useRef } from "react";

// Mientras `open` es true, el botón "atrás" del celular cierra la vista (drawer, panel) en lugar de salir de la página.
// Abre una entrada en el historial; si la vista se cierra desde la interfaz, esa entrada se retira.
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    const marker = { mwSheet: Date.now() };
    window.history.pushState(marker, "");
    let poppedByBack = false;
    const onPop = () => {
      poppedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Cerrado desde la interfaz: quita la entrada que agregamos (si sigue siendo la actual).
      if (!poppedByBack && (window.history.state as { mwSheet?: number } | null)?.mwSheet === marker.mwSheet) window.history.back();
    };
  }, [open]);
}
