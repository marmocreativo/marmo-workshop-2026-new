"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { StudioState, TourStep } from "./use-studio";

type Info = { n: number; title: string; text: string; target?: string; action?: "next" | "finish" };

// Textos del tutorial. `target` es el elemento a resaltar (data-tour); sin él, la tarjeta va centrada.
const STEPS: Record<Exclude<TourStep, "result">, Info> = {
  photo: {
    n: 1,
    title: "¡Hola, bienvenido a Marmo Workshop!",
    text: "Empecemos: elige una foto de tu dispositivo, toma una con la cámara o pégala con Ctrl+V.",
    target: "upload",
  },
  preset: {
    n: 2,
    title: "Elige un preset",
    text: "Abre la Biblioteca y entra a Presets: ahí verás los presets públicos de la comunidad. Toca uno para aplicarlo a tu foto.",
    target: "library",
  },
  process: {
    n: 3,
    title: "Ahora, procesa",
    text: "Pulsa Procesar y espera a que termine. Puede tardar hasta un minuto; no cierres la página.",
    target: "process",
  },
  wait: {
    n: 3,
    title: "Procesando…",
    text: "Estamos creando tu imagen. Espera sin cerrar la página; tu resultado se abrirá solo.",
    target: "gallery",
  },
  edit: {
    n: 5,
    title: "¿No quedó al 100 %?",
    text: "Ajusta lo que quieras: cambia, agrega o quita modificadores, escribe en el prompt manual lo que quieras cambiar, o prueba otro modelo y otra proporción. Luego vuelve a procesar.",
    target: "controls",
    action: "next",
  },
  final: {
    n: 6,
    title: "¡Ahora te toca a ti!",
    text: "Haz una última prueba con otro preset o con tus propios modificadores. Cada proceso gasta tokens según el modelo. ¡A crear!",
    action: "finish",
  },
};

type Rect = { top: number; left: number; width: number; height: number };

// Tutorial para cuentas nuevas: resalta el elemento del paso (sin bloquear los clics) y muestra una tarjeta guía.
export function TourOverlay({ s }: { s: StudioState }) {
  const step = s.tour.step;
  const info = step && step !== "result" ? STEPS[step] : null;
  const [rect, setRect] = useState<Rect | null>(null);
  const [hidden, setHidden] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  // Sigue la posición del elemento (la interfaz cambia de tamaño, hay drawers, etc.).
  useEffect(() => {
    if (!info) return;
    const tick = () => {
      const el = info.target ? document.querySelector<HTMLElement>(`[data-tour="${info.target}"]`) : null;
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setRect((o) => (o && next && o.top === next.top && o.left === next.left && o.width === next.width && o.height === next.height ? o : next));
      setHidden(!!document.querySelector('[role="dialog"]')); // con un drawer o popup abierto se oculta
      setVp((o) => (o.w === window.innerWidth && o.h === window.innerHeight ? o : { w: window.innerWidth, h: window.innerHeight }));
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [info]);

  if (!info || hidden) return null;

  const pad = 6;
  const cardW = Math.min(400, vp.w - 24);
  let cardStyle: React.CSSProperties = { left: Math.max(12, (vp.w - cardW) / 2), top: Math.max(12, vp.h / 2 - 120), width: cardW };
  if (rect) {
    const below = rect.top + rect.height / 2 < vp.h / 2;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vp.w - cardW - 12);
    cardStyle = below
      ? { left, top: Math.min(rect.top + rect.height + 16, vp.h - 260), width: cardW }
      : { left, bottom: Math.max(12, vp.h - rect.top + 16), width: cardW };
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {rect ? (
        <>
          {/* Cuatro paneles con desenfoque rodean el recuadro: lo resaltado queda nítido y el resto de la interfaz, borrosa. */}
          {[
            { top: 0, left: 0, width: "100%", height: Math.max(0, rect.top - pad) },
            { top: rect.top + rect.height + pad, left: 0, width: "100%", height: Math.max(0, vp.h - (rect.top + rect.height + pad)) },
            { top: rect.top - pad, left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2 },
            { top: rect.top - pad, left: rect.left + rect.width + pad, width: Math.max(0, vp.w - (rect.left + rect.width + pad)), height: rect.height + pad * 2 },
          ].map((st, i) => (
            <div key={i} className="absolute bg-black/55 backdrop-blur-[6px] transition-all duration-200" style={st} />
          ))}
          <div
            className="absolute rounded-2xl ring-[3px] ring-primary transition-all duration-200"
            style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          >
            <span className="absolute inset-0 animate-ping rounded-2xl ring-2 ring-primary/70" />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" />
      )}
      <div className="pointer-events-auto absolute" style={cardStyle} role="status">
       {/* key: la tarjeta vuelve a animarse en cada paso */}
       <div
        key={step}
        className="animate-in fade-in-0 zoom-in-90 slide-in-from-bottom-6 rounded-3xl border-2 border-primary bg-popover p-5 text-popover-foreground shadow-[0_20px_60px_rgba(0,0,0,.5)] duration-500"
       >
        <p className="text-xs font-bold tracking-wide text-primary uppercase">Paso {info.n} de 6</p>
        <h3 className="mt-1.5 text-2xl leading-tight font-semibold">{info.title}</h3>
        <p className="mt-2 text-base leading-relaxed text-foreground/85">{info.text}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={s.tour.finish} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            Saltar tutorial
          </button>
          {info.action && (
            <Button className="h-10 px-5 text-base" onClick={info.action === "next" ? s.tour.next : s.tour.finish}>
              {info.action === "next" ? "Siguiente" : "Empezar a crear"}
            </Button>
          )}
        </div>
       </div>
      </div>
    </div>
  );
}
