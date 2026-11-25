"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompact } from "@/lib/use-compact";
import { OnboardingSlides } from "./onboarding-slides";
import type { StudioState, TourStep } from "./use-studio";

type Info = { n: number; text: string; target?: string; action?: "next" | "finish" };

// Tutorial minimalista: una frase de 2-4 palabras por paso y el botón resaltado como única zona tocable.
const STEPS: Record<Exclude<TourStep, "result" | "intro">, Info> = {
  photo: { n: 1, text: "Tómate una selfie", target: "camera" },
  preset: { n: 2, text: "Elige un preset", target: "library" },
  process: { n: 3, text: "Toca Procesar", target: "process" },
  wait: { n: 3, text: "Creando tu imagen, ten paciencia", target: "gallery" },
  edit: { n: 4, text: "Ajusta y repite", target: "controls", action: "next" },
  final: { n: 5, text: "¡Listo! A crear", action: "finish" },
};
const TOTAL = 5;

type Rect = { top: number; left: number; width: number; height: number };

export function TourOverlay({ s }: { s: StudioState }) {
  const step = s.tour.step;
  const info = step && step !== "result" && step !== "intro" ? STEPS[step] : null;
  const compact = useCompact();
  const [rect, setRect] = useState<Rect | null>(null);
  const [hidden, setHidden] = useState(false);
  const [vh, setVh] = useState(0);

  // Sigue la posición del elemento (la interfaz cambia de tamaño, hay drawers, etc.).
  useEffect(() => {
    if (!info) return;
    const tick = () => {
      const el = info.target ? document.querySelector<HTMLElement>(`[data-tour="${info.target}"]`) : null;
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setRect((o) => (o && next && o.top === next.top && o.left === next.left && o.width === next.width && o.height === next.height ? o : next));
      setHidden(!!document.querySelector('[role="dialog"]')); // con un drawer o popup abierto se oculta
      setVh(window.innerHeight);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [info]);

  // Bienvenida: slides con los modos antes del tutorial.
  if (step === "intro") return <OnboardingSlides compact={compact} onDone={s.tour.next} onSkip={s.tour.finish} />;
  if (!info || hidden) return null;

  const pad = 5;
  // La tarjeta se ancla arriba o abajo de la pantalla, del lado contrario al elemento resaltado.
  const targetBelow = !!rect && rect.top + rect.height / 2 > vh / 2;
  const Arrow = targetBelow ? ArrowDown : ArrowUp;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {rect ? (
        <>
          {/* Cuatro paneles oscuros rodean el recuadro y bloquean los toques: solo lo resaltado responde. */}
          {[
            { top: 0, left: 0, width: "100%", height: Math.max(0, rect.top - pad) },
            { top: rect.top + rect.height + pad, left: 0, width: "100%", bottom: 0 },
            { top: rect.top - pad, left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2 },
            { top: rect.top - pad, left: rect.left + rect.width + pad, right: 0, height: rect.height + pad * 2 },
          ].map((st, i) => (
            <div key={i} className="pointer-events-auto absolute bg-black/65" style={st} />
          ))}
          <div
            className="mw-heartbeat absolute rounded-2xl ring-4 ring-primary"
            style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          >
            {!compact && <span className="absolute inset-0 animate-ping rounded-2xl ring-2 ring-primary/60" />}
          </div>
        </>
      ) : (
        <div className={cn("absolute inset-0 bg-black/65", info.action && "pointer-events-auto")} />
      )}

      <div
        role="status"
        className={cn("pointer-events-auto absolute inset-x-3 mx-auto max-w-xs", rect ? (targetBelow ? "top-3" : "bottom-3") : "top-1/2 -translate-y-1/2")}
      >
        <div className="rounded-2xl border-2 border-primary bg-popover px-3 py-2.5 text-popover-foreground shadow-2xl">
          <div className="flex items-center gap-2">
            {rect && <Arrow className={cn("size-5 shrink-0 text-primary", !compact && "animate-bounce")} />}
            <p className="min-w-0 flex-1 text-base leading-tight font-semibold">{info.text}</p>
            <span className="shrink-0 text-xs font-bold text-primary">
              {info.n}/{TOTAL}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <button type="button" onClick={s.tour.finish} className="h-8 px-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
              Saltar
            </button>
            {info.action && (
              <Button size="sm" className="h-8 px-4" onClick={info.action === "next" ? s.tour.next : s.tour.finish}>
                {info.action === "next" ? "Siguiente" : "Empezar"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
