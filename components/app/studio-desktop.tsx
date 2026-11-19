"use client";

import { useRef, useState } from "react";
import { Camera, ClipboardPaste, FolderOpen, ImagePlus, Loader2, Play, Plus, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl } from "@/lib/client";
import { MODELS } from "@/lib/models";
import { cn } from "@/lib/utils";
import { CameraDialog } from "./camera-dialog";
import { Chip, ChipRow } from "./chip";
import { GenerationLightbox } from "./generation-lightbox";
import { RatioPicker, TokenEstimate } from "./generation-options";
import { ModifierEditor } from "./modifier-editor";
import { ModifierBrowser } from "./modifier-picker";
import type { StudioState } from "./use-studio";

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col gap-3 rounded-3xl border bg-card p-4", className)}>
      <header className="flex h-8 items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StudioDesktop({ s }: { s: StudioState }) {
  const [tab, setTab] = useState<"mods" | "images">("mods");
  const [editorOpen, setEditorOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [trash, setTrash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const done = s.gens.filter((g) => g.result_file);
  // Imágenes ya usadas, listas para reutilizar. Las referencias tienen borrado suave (papelera).
  const used = trash
    ? s.gens
        .filter((g) => g.source_file && g.source_deleted_at)
        .map((g) => ({ id: g.id, file: g.source_file!, kind: "Referencia", isRef: true }))
    : [
        ...s.gens
          .filter((g) => g.source_file && !g.source_deleted_at)
          .map((g) => ({ id: g.id, file: g.source_file!, kind: "Referencia", isRef: true })),
        ...done
          .filter((g) => g.kind === "image")
          .map((g) => ({ id: g.id, file: g.result_file!, kind: "Resultado", isRef: false })),
      ];
  const shown = used.slice(0, 90);
  const trashCount = s.gens.filter((g) => g.source_file && g.source_deleted_at).length;

  return (
    <div className="grid h-[calc(100dvh-2.5rem)] grid-cols-[21rem_minmax(0,1fr)_22rem] gap-4 xl:grid-cols-[24rem_minmax(0,1fr)_28rem]">
      {/* Columna 1: biblioteca */}
      <Panel
        title="Biblioteca"
        action={
          tab === "mods" && (
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              <Plus /> Nuevo
            </Button>
          )
        }
      >
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-medium">
          {(
            [
              ["mods", "Modificadores"],
              ["images", "Imágenes"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn("h-8 rounded-lg", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "mods" ? (
          <ModifierBrowser categories={s.categories} modifiers={s.modifiers} selected={s.selected} onToggle={s.toggle} />
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {trash ? "Referencias eliminadas" : "Referencias y resultados anteriores"}
              </span>
              {(trash || trashCount > 0) && (
                <button
                  type="button"
                  onClick={() => setTrash((t) => !t)}
                  className="flex items-center gap-1 font-medium text-primary"
                >
                  {trash ? "Volver" : (<><Trash2 className="size-3" /> Eliminadas ({trashCount})</>)}
                </button>
              )}
            </div>
            {shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {trash ? "La papelera está vacía." : "Aún no has usado imágenes."}
              </p>
            ) : (
              <ul className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto">
                {shown.map((u) => (
                  <li key={`${u.isRef ? "s" : "r"}-${u.id}`} className="group relative">
                    <button
                      type="button"
                      title={trash ? u.kind : `${u.kind}: usar como foto a editar`}
                      disabled={trash}
                      onClick={() => s.useStoredFile(u.file)}
                      className="relative block aspect-square w-full overflow-hidden rounded-xl border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fileUrl(u.file)} alt="" loading="lazy" className={cn("size-full object-cover", trash && "opacity-60")} />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white opacity-0 group-hover:opacity-100">
                        {u.kind}
                      </span>
                    </button>
                    {u.isRef && (
                      <button
                        type="button"
                        aria-label={trash ? "Restaurar imagen" : "Quitar de la biblioteca"}
                        title={trash ? "Restaurar" : "Quitar de la biblioteca"}
                        onClick={() => s.setSourceDeleted(u.id, !trash)}
                        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        {trash ? <Undo2 className="size-3.5" /> : <X className="size-3.5" />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      {/* Columna 2: modelo (foto a editar) */}
      <Panel title="Modelo" className="overflow-y-auto">
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
            if (f) s.setImage(f);
          }}
          className={cn(
            "relative flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-background",
            dragging && "border-primary bg-primary/5",
            s.preview && "border-solid",
          )}
        >
          {s.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.preview} alt="Foto a editar" className="absolute inset-0 size-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
              <ImagePlus className="size-10" />
              <p className="text-sm font-medium text-foreground">Arrastra una foto aquí</p>
              <p className="text-xs">También puedes pegarla con Ctrl+V</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-10 rounded-xl" onClick={() => fileRef.current?.click()}>
            <FolderOpen /> Explorar
          </Button>
          <Button variant="outline" className="h-10 rounded-xl" onClick={() => setCameraOpen(true)}>
            <Camera /> Cámara
          </Button>
          <Button variant="outline" className="h-10 rounded-xl" onClick={s.pasteFromClipboard}>
            <ClipboardPaste /> Pegar
          </Button>
        </div>

        {s.chosen.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
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

        <Textarea
          value={s.freeText}
          onChange={(e) => s.setFreeText(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Texto adicional (opcional)…"
          className="min-h-16 rounded-2xl"
        />

        <ChipRow className="shrink-0">
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

        <RatioPicker modelId={s.model} value={s.ratio} onChange={s.setRatio} />
        <TokenEstimate
          modelId={s.model}
          cost={s.tokenCost}
          balance={s.billing?.account.tokens}
          bypass={s.billing?.account.bypass}
          className="shrink-0"
        />

        <Button
          className="h-12 shrink-0 rounded-2xl text-base"
          disabled={s.busy || !s.image || !s.canAfford}
          onClick={s.process}
        >
          {s.busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {s.busy ? "Procesando… puede tardar un minuto" : s.canAfford ? "Procesar" : "Tokens insuficientes"}
        </Button>
      </Panel>

      {/* Columna 3: galería */}
      <Panel title="Galería">
        <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
          {s.busy && (
            <li className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground">
              <Sparkles className="size-7 animate-pulse text-primary" />
              Generando…
            </li>
          )}
          {s.gens.length === 0 && !s.busy && (
            <li className="col-span-2 py-16 text-center text-sm text-muted-foreground">
              Tus resultados aparecerán aquí.
            </li>
          )}
          {s.gens.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => s.setOpenId(g.id)}
                className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-muted transition-transform hover:scale-[1.01]"
              >
                {g.result_file ? (
                  g.kind === "video" ? (
                    <>
                      <video src={fileUrl(g.result_file)} muted playsInline preload="metadata" className="size-full object-cover" />
                      <Play className="absolute top-2 right-2 size-5 fill-white text-white drop-shadow" />
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(g.result_file)} alt="" loading="lazy" className="size-full object-cover" />
                  )
                ) : (
                  <span className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                    {g.status === "error" ? "Falló" : "Procesando"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <ModifierEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        categories={s.categories}
        onSaved={s.applyCreated}
        appliesOnScan
      />
      <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={s.setImage} />
      <GenerationLightbox
        items={s.gens}
        openId={s.openId}
        onOpenChange={s.setOpenId}
        onDelete={s.deleteGen}
        onReuse={s.reuse}
        onVisibility={s.setVisibility}
      />
    </div>
  );
}
