"use client";

import { useEffect, useRef } from "react";
import { installPopup, updatePopup } from "@/lib/alerts";
import { applyUpdate, promptInstall, startPwa, usePwa } from "@/lib/pwa";

const KEY = "mw:install-dismissed";
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Invisible: arranca el service worker, revisa si la app está instalada y actualizada, y muestra los avisos. */
export function PwaManager({ autoOffer }: { autoOffer: boolean }) {
  const pwa = usePwa();
  const offered = useRef(false);
  const warned = useRef<string | null>(null);

  useEffect(() => startPwa(), []);

  // Ofrece instalar (una vez por sesión y como máximo cada 7 días si se descarta).
  useEffect(() => {
    if (!autoOffer || !pwa.ready || pwa.installed || offered.current) return;
    if (!pwa.canInstall && !pwa.ios) return;
    try {
      if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < WEEK) return;
    } catch {}
    offered.current = true;
    const t = setTimeout(async () => {
      const yes = await installPopup(pwa.ios && !pwa.canInstall);
      if (yes) await promptInstall();
      else
        try {
          localStorage.setItem(KEY, String(Date.now()));
        } catch {}
    }, 4000);
    return () => clearTimeout(t);
  }, [autoOffer, pwa.ready, pwa.installed, pwa.canInstall, pwa.ios]);

  // Avisa una vez por versión nueva detectada.
  useEffect(() => {
    if (!pwa.updateAvailable) return;
    const id = pwa.latestVersion ?? "nueva";
    if (warned.current === id) return;
    warned.current = id;
    updatePopup(pwa.latestVersion).then((yes) => {
      if (yes) applyUpdate();
    });
  }, [pwa.updateAvailable, pwa.latestVersion]);

  return null;
}
