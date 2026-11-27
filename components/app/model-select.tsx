"use client";

import Image from "next/image";
import { MODELS, modelIcon } from "@/lib/models";
import { GhostMenu } from "./ghost-menu";

// Selector de modelo con su icono; el menú se alinea a la derecha.
export function ModelSelect({
  value,
  onChange,
  onOpenChange,
  locked,
}: {
  value: string;
  onChange: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** Modelos que el plan actual no permite (se muestran con candado). */
  locked?: (id: string) => boolean;
}) {
  return (
    <GhostMenu
      label="Modelo"
      align="right"
      value={value}
      onChange={onChange}
      onOpenChange={onOpenChange}
      options={MODELS.map((m) => ({
        value: m.id,
        label: m.label,
        sub: locked?.(m.id) ? "🔒 Planes de pago" : `${m.provider}${m.kind === "video" ? " · Video" : ""}`,
        locked: locked?.(m.id),
        icon: <Image src={modelIcon(m.id)} alt="" width={28} height={28} className="size-7 rounded-md object-cover" />,
      }))}
    />
  );
}
