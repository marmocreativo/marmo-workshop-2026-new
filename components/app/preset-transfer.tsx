"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { getMode, type StudioMode } from "@/lib/modes";

// Exportar / importar presets en un archivo JSON (incluye portada, materiales y modificadores).
export function PresetTransfer({ mode, onImported, size = "sm" }: { mode?: StudioMode; onImported: () => void | Promise<void>; size?: "sm" | "default" }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  async function exportFile() {
    setBusy("out");
    try {
      const res = await fetch(`/api/presets/export${mode ? `?mode=${mode}` : ""}`);
      if (!res.ok) throw new Error("No pude exportar los presets");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `marmo-presets${mode ? `-${mode}` : ""}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function importFile(f: File) {
    setBusy("in");
    try {
      const r = await api<{ imported: number; skipped: number; coversGenerated?: number }>("/api/presets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await f.text(),
      });
      await onImported();
      toast.success(`${r.imported} preset${r.imported === 1 ? "" : "s"} importado${r.imported === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} vacíos omitidos)` : ""}${r.coversGenerated ? ` · ${r.coversGenerated} portadas generadas con IA` : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importFile(f);
        }}
      />
      <Button variant="outline" size={size} disabled={!!busy} onClick={() => fileRef.current?.click()} title="Importar presets desde un archivo JSON">
        {busy === "in" ? <Loader2 className="animate-spin" /> : <Upload />} Importar
      </Button>
      <Button
        variant="outline"
        size={size}
        disabled={!!busy}
        onClick={exportFile}
        title={mode ? `Descargar tus presets de ${getMode(mode).label} en JSON` : "Descargar todos tus presets en JSON"}
      >
        {busy === "out" ? <Loader2 className="animate-spin" /> : <Download />} Exportar
      </Button>
    </div>
  );
}
