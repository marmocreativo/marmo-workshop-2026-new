"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Camera, Download, Loader2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl } from "@/lib/client";
import { MODELS } from "@/lib/models";
import { cn } from "@/lib/utils";
import { Chip, ChipRow } from "./chip";
import { RatioPicker, TokenEstimate } from "./generation-options";
import { ModifierEditor } from "./modifier-editor";
import { ModifierPicker } from "./modifier-picker";
import type { StudioState } from "./use-studio";

export function StudioMobile({ s }: { s: StudioState }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { result } = s;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-36">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Photo Studio</h1>
        <p className="text-sm text-muted-foreground">Sube una foto, elige modificadores y procesa.</p>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) s.setImage(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          "relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed bg-card",
          s.preview && "border-solid",
        )}
      >
        {s.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.preview} alt="Foto de referencia" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <Camera className="size-9" />
            <span className="text-sm font-medium">Toca para agregar una foto</span>
            <span className="text-xs">De una persona o un grupo</span>
          </span>
        )}
        {s.preview && (
          <span className="absolute right-3 bottom-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow">
            Cambiar foto
          </span>
        )}
      </button>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Modificadores</h2>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus /> Agregar
          </Button>
        </div>
        {s.chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Aún no has elegido modificadores.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {s.chosen.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => s.toggle(m.id)}
                  className="flex max-w-full items-center gap-1.5 rounded-full bg-primary/15 py-1.5 pr-2 pl-3 text-left text-xs text-primary"
                >
                  <span className="line-clamp-1">{m.text}</span>
                  <X className="size-3.5 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Texto adicional</h2>
        <Textarea
          value={s.freeText}
          onChange={(e) => s.setFreeText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Algo más que quieras pedirle al modelo…"
          className="rounded-2xl text-base"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Modelo</h2>
        <ChipRow>
          {MODELS.map((m) => (
            <Chip
              key={m.id}
              active={s.model === m.id}
              onClick={() => s.setModel(m.id)}
              className="h-auto flex-col items-start gap-0 py-1.5"
            >
              <span>{m.label}</span>
              <span className="text-[10px] font-normal opacity-70">{m.provider}</span>
            </Chip>
          ))}
        </ChipRow>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Proporción</h2>
        <RatioPicker modelId={s.model} value={s.ratio} onChange={s.setRatio} />
      </section>

      <div className="pb-safe fixed inset-x-0 bottom-[3.75rem] z-30 space-y-2 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-2">
        <TokenEstimate
          modelId={s.model}
          cost={s.tokenCost}
          balance={s.billing?.account.tokens}
          bypass={s.billing?.account.bypass}
          className="mx-auto max-w-xl px-1"
        />
        <Button
          className="mx-auto flex h-12 w-full max-w-xl rounded-2xl text-base"
          disabled={s.busy || !s.image || !s.canAfford}
          onClick={s.process}
        >
          {s.busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {s.busy ? "Procesando… puede tardar un minuto" : s.canAfford ? "Procesar" : "Tokens insuficientes"}
        </Button>
      </div>

      <ModifierPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={s.categories}
        modifiers={s.modifiers}
        selected={s.selected}
        onToggle={s.toggle}
        onCreate={() => setEditorOpen(true)}
      />
      <ModifierEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        categories={s.categories}
        onSaved={s.applyCreated}
        appliesOnScan
      />

      <Dialog open={!!result} onOpenChange={(o) => !o && s.setResult(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>¡Listo!</DialogTitle>
            <DialogDescription>Se guardó en tu galería junto con los modificadores usados.</DialogDescription>
          </DialogHeader>
          {result &&
            (result.kind === "video" ? (
              <video src={fileUrl(result.resultFile)} controls playsInline className="w-full rounded-2xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(result.resultFile)} alt="Resultado" className="w-full rounded-2xl" />
            ))}
          <div className="grid grid-cols-2 gap-2">
            {result && (
              <a
                href={fileUrl(result.resultFile)}
                download
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium"
              >
                <Download className="size-4" /> Descargar
              </a>
            )}
            <Link href="/galeria" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground">
              Ver galería
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
