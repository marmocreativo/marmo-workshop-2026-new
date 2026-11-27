"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Package, PartyPopper, Sun } from "lucide-react";
import type { StudioMode } from "@/lib/modes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompact } from "@/lib/use-compact";
import { OnboardingSlides } from "./onboarding-slides";
import type { StudioState, TourStep } from "./use-studio";

type Info = { n: number; text: string; target?: string; action?: "next" | "finish" };

// Tutorial minimalista: una frase de 2-4 palabras por paso y el botón resaltado como única zona tocable.
const STEPS: Record<Exclude<TourStep, "result" | "intro" | "goal">, Info> = {
  photo: { n: 2, text: "Sube o toma una foto", target: "photo" },
  preset: { n: 3, text: "Elige un preset", target: "library" },
  process: { n: 4, text: "Toca Procesar", target: "process" },
  wait: { n: 4, text: "Creando tu imagen, ten paciencia", target: "gallery" },
  edit: { n: 5, text: "Ajusta y repite", target: "controls", action: "next" },
  final: { n: 6, text: "¡Listo! A crear", action: "finish" },
};
const TOTAL = 6;

// El texto del paso de la foto depende de lo que eligió hacer.
const PHOTO_TEXT: Record<StudioMode, string> = {
  filtro: "Tómate una selfie o sube una foto",
  producto: "Sube la foto de tu producto",
  ocio: "Sube una foto de personas o mascotas",
  pro: "Sube o toma una foto",
};

// Paso 1: ¿qué quieres hacer? Define el modo del resto del tutorial.
const GOALS: { mode: StudioMode; icon: React.ComponentType<{ className?: string }>; title: string; sub: string }[] = [
  { mode: "filtro", icon: Sun, title: "Mejorar una selfie", sub: "Luz, fondo y acabado, sin cambiar la foto" },
  { mode: "producto", icon: Package, title: "Foto de producto para tu negocio", sub: "Fondo y luz profesionales" },
  { mode: "ocio", icon: PartyPopper, title: "Algo alocado", sub: "Personajes, escenarios y poses nuevas" },
];

type Rect = { top: number; left: number; width: number; height: number };

export function TourOverlay({ s }: { s: StudioState }) {
  const step = s.tour.step;
  const base = step && step !== "result" && step !== "intro" && step !== "goal" ? STEPS[step] : null;
  const info = useMemo(() => (base && step === "photo" ? { ...base, text: PHOTO_TEXT[s.mode] } : base), [base, step, s.mode]);
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
  if (step === "goal")
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
        <div role="dialog" aria-label="¿Qué quieres hacer?" className="w-full max-w-sm rounded-3xl border-2 border-primary bg-popover p-4 text-popover-foreground shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-semibold">¿Qué quieres hacer?</p>
            <span className="text-xs font-bold text-primary">1/{TOTAL}</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {GOALS.map(({ mode, icon: Icon, title, sub }) => (
              <button
                key={mode}
                type="button"
                onClick={() => s.tour.chooseGoal(mode)}
                className="flex items-center gap-3 rounded-2xl border bg-background/50 p-3 text-left transition-colors hover:border-primary hover:bg-primary/10"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">¿{title}?</span>
                  <span className="block text-xs text-muted-foreground">{sub}</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={s.tour.finish} className="mt-2 h-8 px-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
            Saltar
          </button>
        </div>
      </div>
    );
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
