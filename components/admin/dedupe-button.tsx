"use client";

import { useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { confirmAction, toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

export function DedupeButton() {
  const [busy, setBusy] = useState(false);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card p-5">
      <div>
        <h2 className="font-medium">Compactar imágenes duplicadas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Unifica las imágenes idénticas que ya estaban guardadas varias veces y libera espacio en disco.</p>
      </div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          if (!(await confirmAction("Se conservará una sola copia de cada imagen repetida. No afecta a tus resultados.", { title: "¿Compactar imágenes?", confirmText: "Compactar" }))) return;
          setBusy(true);
          try {
            const r = await api<{ removed: number; freedMb: number }>("/api/admin/dedupe", { method: "POST" });
            toast.success(`${r.removed} archivos duplicados eliminados · ${r.freedMb} MB liberados`);
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Layers />} Compactar
      </Button>
    </section>
  );
}
