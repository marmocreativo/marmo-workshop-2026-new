"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODES, type ModeDef } from "@/lib/modes";
import { cn } from "@/lib/utils";
import { MODE_ICONS } from "./mode-switcher";

// Ilustración del slide: usa /onboarding/<modo>.webp si existe; si no, el icono del modo.
function Art({ mode }: { mode?: ModeDef }) {
  const [broken, setBroken] = useState(false);
  const Icon = mode ? MODE_ICONS[mode.id] : Sparkles;
  return (
    <div className="relative mx-auto flex aspect-[4/3] w-full max-w-xs items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
      <Icon className="size-16 text-primary" />
      {mode && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/onboarding/${mode.id}.webp`} alt="" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

// Bienvenida en slides: qué es la app, sus 4 modos y cómo se usa. Al terminar empieza el tutorial.
export function OnboardingSlides({ onDone, onSkip, compact }: { onDone: () => void; onSkip: () => void; compact: boolean }) {
  const [i, setI] = useState(0);
  const total = MODES.length + 2;
  const last = i === total - 1;
  const startX = useRef<number | null>(null);
  const go = (d: number) => setI((n) => Math.min(total - 1, Math.max(0, n + d)));

  const mode = i >= 1 && i <= MODES.length ? MODES[i - 1] : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bienvenida"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
        className={cn("w-full max-w-md select-none rounded-3xl border-2 border-primary bg-popover text-popover-foreground shadow-2xl", compact ? "p-4" : "p-6")}
      >
        {/* Alto fijo: los botones no brincan de lugar entre slides. */}
        <div key={i} className={cn("animate-in fade-in-0 slide-in-from-right-4 space-y-4 text-center duration-300", compact ? "min-h-[19rem]" : "min-h-[25rem]")}>
          {i === 0 && (
            <>
              <Art />
              <h2 className={cn("font-semibold leading-tight", compact ? "text-xl" : "text-2xl")}>Bienvenido a Marmo Workshop</h2>
              <p className="text-base text-foreground/85">Edita tus fotos con IA en segundos. Elige un modo y listo.</p>
            </>
          )}
          {mode && (
            <>
              <Art mode={mode} />
              <p className="text-xs font-bold tracking-wide text-primary uppercase">Modo {i} de {MODES.length}</p>
              <h2 className={cn("font-semibold leading-tight", compact ? "text-xl" : "text-2xl")}>{mode.label}</h2>
              <p className="text-base text-foreground/85">{compact ? mode.tagline : mode.description}</p>
            </>
          )}
          {last && (
            <>
              <h2 className={cn("font-semibold leading-tight", compact ? "text-xl" : "text-2xl")}>Así de fácil</h2>
              <ol className="mx-auto max-w-xs space-y-3 text-left">
                {[
                  [ImagePlus, "Sube tu foto"],
                  [Layers, "Elige un preset"],
                  [Sparkles, "Toca Procesar"],
                ].map(([Icon, text], k) => {
                  const I = Icon as typeof ImagePlus;
                  return (
                    <li key={k} className="flex items-center gap-3 rounded-2xl bg-muted p-3 text-base font-medium">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <I className="size-5" />
                      </span>
                      {text as string}
                    </li>
                  );
                })}
              </ol>
              <p className="text-sm text-muted-foreground">Tu primera imagen es gratis. Te guiamos paso a paso.</p>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: total }, (_, k) => (
            <span key={k} className={cn("h-2 rounded-full transition-all", k === i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30")} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {i === 0 ? (
            <button type="button" onClick={onSkip} className="h-11 px-2 text-sm text-muted-foreground underline-offset-2 hover:underline">
              Saltar
            </button>
          ) : (
            <Button variant="ghost" className="h-11" onClick={() => go(-1)} aria-label="Anterior">
              <ArrowLeft />
            </Button>
          )}
          <Button className="h-12 px-6 text-base" onClick={last ? onDone : () => go(1)}>
            {last ? "¡Empezar!" : "Siguiente"} {!last && <ArrowRight />}
          </Button>
        </div>
      </div>
    </div>
  );
}
