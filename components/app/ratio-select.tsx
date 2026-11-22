"use client";

import { Scan } from "lucide-react";
import { GhostMenu } from "./ghost-menu";

// Rectángulo dibujado con la proporción (p. ej. 16:9 ancho, 9:16 alto) dentro de una caja de 20 px.
function RatioIcon({ ratio }: { ratio: string }) {
  const [a, b] = ratio.split(":").map(Number);
  if (!a || !b) return <Scan className="size-5 text-white/80" />;
  const max = 20;
  const w = a >= b ? max : Math.round((max * a) / b);
  const h = a >= b ? Math.round((max * b) / a) : max;
  return <span className="rounded-[3px] border-2 border-white/80" style={{ width: w, height: h }} />;
}

// Selector de proporción con el dibujo de cada una. Si el modelo no admite proporciones, queda fijo en "Original".
export function RatioSelect({
  value,
  onChange,
  ratios,
  onOpenChange,
}: {
  value: string;
  onChange: (ratio: string) => void;
  ratios: string[];
  onOpenChange?: (open: boolean) => void;
}) {
  const fixed = ratios.length === 0;
  return (
    <GhostMenu
      label="Proporción"
      align="left"
      value={fixed ? "auto" : value}
      onChange={onChange}
      onOpenChange={onOpenChange}
      disabled={fixed}
      options={[
        { value: "auto", label: fixed ? "Original" : "Auto", sub: "Como tu foto", icon: <RatioIcon ratio="auto" /> },
        ...ratios.map((r) => ({ value: r, label: r, icon: <RatioIcon ratio={r} /> })),
      ]}
    />
  );
}
