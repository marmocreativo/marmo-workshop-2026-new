"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CLIENT = "ca-pub-6316196480784999";
export const AD_SLOTS = { gallery: "8341702946" } as const;

type W = Window & { adsbygoogle?: unknown[] };

// Bloque de AdSense. Solo aparece si el layout cargó el script (visitantes y tier gratuito, en producción).
export function AdSlot({ slot, className }: { slot: string; className?: string }) {
  const [enabled, setEnabled] = useState(false);
  const pushed = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(!!document.querySelector('script[src*="adsbygoogle.js"]'));
  }, []);
  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    try {
      const w = window as W;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {}
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div className={cn("overflow-hidden", className)}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
