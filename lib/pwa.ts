"use client";

import { useSyncExternalStore } from "react";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type PwaState = {
  /** Ya se inició el chequeo (en el servidor o antes de montar, los demás valores no son confiables). */
  ready: boolean;
  /** La app se está ejecutando como app instalada (ventana propia). */
  installed: boolean;
  /** El navegador ofrece instalar con un clic. */
  canInstall: boolean;
  /** iPhone/iPad: no hay botón de instalar, se hace desde Compartir. */
  ios: boolean;
  /** Hay un despliegue más nuevo que el que tiene cargado este dispositivo. */
  updateAvailable: boolean;
  /** Versión del servidor cuando hay actualización. */
  latestVersion: string | null;
  checking: boolean;
};

const SERVER: PwaState = { ready: false, installed: false, canInstall: false, ios: false, updateAvailable: false, latestVersion: null, checking: false };
let state = SERVER;
let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Compara con el servidor. Devuelve true si hay una versión más nueva. */
export async function checkForUpdate(): Promise<boolean> {
  set({ checking: true });
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    const v = (await r.json()) as { version?: string; build?: string };
    const newer = !!v.build && !!BUILD_ID && v.build !== BUILD_ID;
    set({ updateAvailable: newer, latestVersion: newer ? (v.version ?? null) : null });
    return newer;
  } catch {
    return false; // sin conexión: no se puede saber
  } finally {
    set({ checking: false });
  }
}

/** Arranca el chequeo de instalación y versión (una sola vez). */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ ready: true, installed: isStandalone(), ios: isIos() });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // se ofrece desde nuestro propio diálogo
    deferred = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    set({ installed: true, canInstall: false });
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => set({ installed: isStandalone() }));

  // El service worker solo se registra en producción (en desarrollo rompería el hot reload).
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).catch(() => {});
    // Un worker nuevo toma el control cuando hay una versión nueva.
  }

  if (process.env.NODE_ENV === "production") {
    checkForUpdate();
    setInterval(checkForUpdate, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkForUpdate());
  }
}

/** Abre el aviso nativo de instalación. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  set({ canInstall: false });
  return outcome;
}

/** Carga la versión nueva: limpia cachés de versiones anteriores y recarga. */
export async function applyUpdate() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("mw-")).map((k) => caches.delete(k)));
  } catch {}
  location.reload();
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER,
  );
}
