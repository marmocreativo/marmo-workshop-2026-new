"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Layers, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompact } from "@/lib/use-compact";
import type { StudioState, TourStep } from "./use-studio";

type Info = { n: number; title: string; text: string; short: string; target?: string; action?: "next" | "finish" };

// Textos del tutorial. `target` es el elemento a resaltar (data-tour); sin él, la tarjeta va centrada.
const STEPS: Record<Exclude<TourStep, "result" | "intro">, Info> = {
  photo: {
    n: 1,
    title: "¡Hola, bienvenido a Marmo Workshop!",
    text: "Empecemos: elige una foto de tu dispositivo, toma una con la cámara o pégala con Ctrl+V.",
    short: "Elige una foto o toma una con la cámara.",
    target: "upload",
  },
  preset: {
    n: 2,
    title: "Elige un preset",
    text: "Abre la Biblioteca y entra a Presets: ahí verás los presets públicos de la comunidad. Toca uno para aplicarlo a tu foto.",
    short: "Abre la biblioteca y toca un preset.",
    target: "library",
  },
  process: {
    n: 3,
    title: "Ahora, procesa",
    text: "Pulsa Procesar y espera a que termine. Esta primera generación es gratis con los modelos estándar. Puede tardar hasta un minuto; no cierres la página.",
    short: "Pulsa Procesar. La primera es gratis.",
    target: "process",
  },
  wait: {
    n: 3,
    title: "Procesando…",
    text: "Estamos creando tu imagen. Espera sin cerrar la página; tu resultado se abrirá solo.",
    short: "Creando tu imagen. No cierres la página.",
    target: "gallery",
  },
  edit: {
    n: 5,
    title: "¿No quedó al 100 %?",
    text: "Ajusta lo que quieras: cambia, agrega o quita modificadores, escribe en el prompt manual lo que quieras cambiar, o prueba otro modelo y otra proporción. Luego vuelve a procesar.",
    short: "Ajusta modificadores, prompt o modelo y vuelve a procesar.",
    target: "controls",
    action: "next",
  },
  final: {
    n: 6,
    title: "¡Ahora te toca a ti!",
    text: "Haz una última prueba con otro preset o con tus propios modificadores. Cada proceso gasta tokens según el modelo. ¡A crear!",
    short: "Prueba otro preset. ¡A crear!",
    action: "finish",
  },
};

type Rect = { top: number; left: number; width: number; height: number };

// Tutorial para cuentas nuevas: resalta el elemento del paso (sin bloquear los clics) y muestra una tarjeta guía.
export function TourOverlay({ s }: { s: StudioState }) {
  const step = s.tour.step;
  const info = step && step !== "result" && step !== "intro" ? STEPS[step] : null;
  const compact = useCompact();
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
    const id = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [info]);

  // Bienvenida: antes del tutorial explica qué es la aplicación y cómo se usa.
  if (step === "intro") {
    const points = [
      { Icon: ImagePlus, text: compact ? "Agrega una foto tuya, de tu mascota o de un grupo." : "Agrega una fotografía tuya, de una mascota o de un grupo de personas." },
      { Icon: Layers, text: compact ? "Elige un preset." : "Elige un preset como punto de inicio." },
      { Icon: SlidersHorizontal, text: compact ? "Edita presets y modificadores y guárdalos." : "Puedes modificar los presets y los modificadores de texto para guardarlos y tener resultados consistentes." },
    ];
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:backdrop-blur-[6px]">
        <div role="dialog" aria-modal="true" className="animate-in fade-in-0 w-full max-w-md rounded-3xl border-2 border-primary bg-popover p-4 text-popover-foreground sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,.5)] duration-500">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="size-6" />
          </span>
          <h3 className="mt-3 text-xl leading-tight font-semibold">Bienvenido a Marmo Workshop</h3>
          {!compact && <p className="mt-2 text-base leading-relaxed text-foreground/85">Una aplicación de edición avanzada de fotografías usando IA.</p>}
          <ol className="mt-3 space-y-2.5">
            {points.map(({ Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center justify-between gap-2">
            <button type="button" onClick={s.tour.finish} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Saltar
            </button>
            <Button className="h-10 px-5 text-base" onClick={s.tour.next}>
              Empezar el tutorial
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!info || hidden) return null;

  const pad = 6;
  const cardW = Math.min(400, vp.w - 24);
  // La tarjeta va donde quepa dentro de la pantalla: abajo o arriba del recuadro; si es una columna alta
  // (escritorio), a su lado; y si nada cabe, encima. Así nunca queda fuera de la vista.
  const cardH = 300; // alto estimado de la tarjeta
  const m = 12;
  const gap = pad + 16;
  const clampX = (x: number) => Math.min(Math.max(m, x), Math.max(m, vp.w - cardW - m));
  const clampY = (y: number) => Math.min(Math.max(m, y), Math.max(m, vp.h - cardH - m));
  const dockTop = !!rect && rect.top + rect.height / 2 > vp.h / 2; // en pantallas pequeñas la tarjeta se ancla arriba o abajo
  let cardStyle: React.CSSProperties = { left: clampX((vp.w - cardW) / 2), top: clampY(vp.h / 2 - cardH / 2), width: cardW };
  if (rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const spaceBelow = vp.h - (rect.top + rect.height) - gap - m;
    const spaceAbove = rect.top - gap - m;
    const spaceRight = vp.w - (rect.left + rect.width) - gap - m;
    const spaceLeft = rect.left - gap - m;
    const below = { left: clampX(cx - cardW / 2), top: rect.top + rect.height + gap, width: cardW };
    const above = { left: clampX(cx - cardW / 2), top: rect.top - gap - cardH, width: cardW };
    const right = { left: rect.left + rect.width + gap, top: clampY(cy - cardH / 2), width: cardW };
    const leftSide = { left: rect.left - gap - cardW, top: clampY(cy - cardH / 2), width: cardW };
    const vertical: [boolean, React.CSSProperties][] =
      cy < vp.h / 2
        ? [[spaceBelow >= cardH, below], [spaceAbove >= cardH, above]]
        : [[spaceAbove >= cardH, above], [spaceBelow >= cardH, below]];
    const sides: [boolean, React.CSSProperties][] =
      cx < vp.w / 2
        ? [[spaceRight >= cardW, right], [spaceLeft >= cardW, leftSide]]
        : [[spaceLeft >= cardW, leftSide], [spaceRight >= cardW, right]];
    const pick = [...vertical, ...sides].find(([fits]) => fits);
    // Sin espacio en ningún lado (el recuadro ocupa casi toda la pantalla): sobre el recuadro, centrada.
    cardStyle = pick ? pick[1] : { left: clampX(cx - cardW / 2), top: clampY(cy - cardH / 2), width: cardW };
  }

  if (compact) cardStyle = { left: m, right: m, ...(dockTop ? { top: m } : { bottom: m }) };

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
            <div key={i} className={cn("absolute bg-black/55 transition-all duration-200", !compact && "backdrop-blur-[6px]")} style={st} />
          ))}
          <div
            className="absolute rounded-2xl ring-[3px] ring-primary transition-all duration-200"
            style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          >
            {!compact && <span className="absolute inset-0 animate-ping rounded-2xl ring-2 ring-primary/70" />}
          </div>
        </>
      ) : (
        <div className={cn("absolute inset-0 bg-black/60", !compact && "backdrop-blur-[6px]")} />
      )}
      <div className="pointer-events-auto absolute" style={cardStyle} role="status">
       {/* key: la tarjeta vuelve a animarse en cada paso */}
       <div
        key={step}
        className={cn("rounded-3xl border-2 border-primary bg-popover text-popover-foreground shadow-[0_20px_60px_rgba(0,0,0,.5)]", compact ? "p-3" : "animate-in fade-in-0 zoom-in-90 slide-in-from-bottom-6 p-5 duration-500")}
       >
        <p className="text-xs font-bold tracking-wide text-primary uppercase">Paso {info.n} de 6</p>
        <h3 className={cn("font-semibold leading-tight", compact ? "mt-0.5 text-base" : "mt-1.5 text-2xl")}>{info.title}</h3>
        <p className={cn("text-foreground/85", compact ? "mt-1 text-sm leading-snug" : "mt-2 text-base leading-relaxed")}>{compact ? info.short : info.text}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={s.tour.finish} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            {compact ? "Saltar" : "Saltar tutorial"}
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
