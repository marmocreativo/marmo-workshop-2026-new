"use client";

import { useEffect, useState } from "react";

// Saldo de tokens en vivo: cualquier parte de la UI puede anunciar un saldo nuevo o pedir que se recargue;
// los contadores (barra móvil, riel de escritorio, Studio) se actualizan solos. Además se consulta cada 20 s,
// al volver a la pestaña y al recuperar la conexión (p. ej. tokens acreditados por Stripe).
const SET = "mw:balance";
const REFRESH = "mw:balance-refresh";

export const emitBalance = (tokens: number) => window.dispatchEvent(new CustomEvent<number>(SET, { detail: tokens }));
export const requestBalanceRefresh = () => window.dispatchEvent(new Event(REFRESH));

async function fetchBalance(): Promise<number | null> {
  try {
    const r = await fetch("/api/billing/me", { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { account: { tokens: number } }).account.tokens;
  } catch {
    return null;
  }
}

/** Escucha el saldo; `initial` es el valor que renderizó el servidor. */
export function useLiveBalance(initial: number) {
  const [tokens, setTokens] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setTokens(initial);
  }

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (document.visibilityState === "hidden") return;
      const n = await fetchBalance();
      if (alive && n !== null) setTokens(n);
    };
    const onSet = (e: Event) => setTokens((e as CustomEvent<number>).detail);
    window.addEventListener(SET, onSet);
    window.addEventListener(REFRESH, pull);
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", pull);
    const timer = setInterval(pull, 20_000);
    return () => {
      alive = false;
      window.removeEventListener(SET, onSet);
      window.removeEventListener(REFRESH, pull);
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", pull);
      clearInterval(timer);
    };
  }, []);

  return tokens;
}
