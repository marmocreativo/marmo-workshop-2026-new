"use client";

import Image from "next/image";
import { MODELS, modelIcon } from "@/lib/models";
import { GhostMenu } from "./ghost-menu";

// Selector de modelo con su icono; el menú se alinea a la derecha.
export function ModelSelect({
  value,
  onChange,
  onOpenChange,
}: {
  value: string;
  onChange: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
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
        sub: `${m.provider}${m.kind === "video" ? " · Video" : ""}`,
        icon: <Image src={modelIcon(m.id)} alt="" width={28} height={28} className="size-7 rounded-md object-cover" />,
      }))}
    />
  );
}
