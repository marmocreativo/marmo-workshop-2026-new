"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ClipboardPaste, FolderOpen, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModel, MODELS } from "@/lib/models";
import { cn } from "@/lib/utils";
import { CameraDialog } from "./camera-dialog";
import type { StudioState } from "./use-studio";

const ICON_BTN = "flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/80";
const POPUP_W = 224; // ancho del popup del modificador en móvil
const PILL_W = 152; // ancho de la píldora contraída
const PILL_H = 36;
const ROW_STEP = 56;
const TOP = 16;
const TOP_WITH_CORNER = 68; // deja libres los botones de los drawers (móvil)
const OVERLAY_SAFE = 250; // alto reservado abajo para los controles

type Pt = { x: number; y: number }; // fracciones del lienzo (0-1)

// Select "ghost" nativo sobre fondo oscuro.
function GhostSelect({
  value,
  onChange,
  children,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-10 w-full cursor-pointer appearance-none truncate rounded-xl bg-white/10 pr-8 pl-3 text-sm font-medium text-white outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-60 [&>option]:bg-neutral-900 [&>option]:text-white"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-white/70" />
    </div>
  );
}

export function StudioCanvas({ s, corner }: { s: StudioState; corner?: React.ReactNode }) {
  const top0 = corner ? TOP_WITH_CORNER : TOP;
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pts, setPts] = useState<Record<string, Pt>>({});
  const drag = useRef<string | null>(null);
  // Móvil: solo se ven los pointers; al tocar uno se abre su popup (arrastrable) con el modificador.
  const touch = !!corner;
  const [open, setOpen] = useState<string | null>(null);
  const [pillPos, setPillPos] = useState<Record<string, Pt>>({});
  const tap = useRef({ x: 0, y: 0, moved: false });
  const pillDrag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const model = getModel(s.model) ?? MODELS[0];
  const rows = Math.max(1, Math.floor((size.h - OVERLAY_SAFE - top0) / ROW_STEP));

  // Geometría de cada píldora: lado alterno, filas hacia abajo; el ancla de la línea es su esquina interior inferior.
  const layout = s.chosen.map((m, i) => {
    const right = i % 2 === 1;
    const slot = Math.floor(i / 2);
    const row = slot % rows;
    const layer = Math.floor(slot / rows);
    const edge = 16 + layer * 24;
    const top = top0 + row * ROW_STEP;
    const ax = right ? size.w - edge - PILL_W + 16 : edge + PILL_W - 16;
    const ay = top + PILL_H;
    const saved = pts[m.id];
    // Móvil: los pointers se reparten en cuadrícula en la parte alta de la foto.
    const px = saved ? saved.x * size.w : touch ? size.w * (0.2 + (i % 3) * 0.3) : ax + (right ? -1 : 1) * (56 + slot * 14);
    const py = saved ? saved.y * size.h : touch ? top0 + 24 + Math.floor(i / 3) * 48 : ay + 24;
    // Popup móvil: junto al pointer salvo que el usuario lo haya movido.
    const pp = pillPos[m.id];
    const pl = pp ? pp.x * size.w : Math.min(Math.max(px - 24, 8), Math.max(8, size.w - POPUP_W - 8));
    const pt = pp ? pp.y * size.h : py + 26;
    return { m, right, edge, top, ax, ay, px, py, pl, pt };
  });

  function movePill(e: React.PointerEvent) {
    const d = pillDrag.current;
    if (!d) return;
    const r = boxRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - r.left - d.dx) / r.width, 0), Math.max(0, 1 - (POPUP_W + 8) / r.width));
    const y = Math.min(Math.max((e.clientY - r.top - d.dy) / r.height, 0), 0.9);
    setPillPos((p) => ({ ...p, [d.id]: { x, y } }));
  }

  function moveTo(id: string, e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0.02), 0.98);
    const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0.02), 0.98);
    setPts((p) => ({ ...p, [id]: { x, y } }));
  }

  const catName = (id: string) => s.categories.find((c) => c.id === id)?.name ?? "";

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border bg-black">
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
        ref={boxRef}
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
        className={cn("relative min-h-0 flex-1 overflow-hidden", dragging && "ring-4 ring-primary ring-inset")}
      >
        {s.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.preview} alt="Foto a editar" className={cn("absolute inset-0 size-full", corner ? "object-cover" : "object-contain")} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 pb-64 text-center text-white/70">
            <ImagePlus className="size-12" />
            <p className="text-base font-medium text-white">Arrastra una foto aquí</p>
            <p className="text-sm">o pégala con Ctrl+V</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" className="rounded-xl bg-white/10 text-white hover:bg-white/20" onClick={() => fileRef.current?.click()}>
                <FolderOpen /> Explorar
              </Button>
              <Button variant="outline" className="rounded-xl bg-white/10 text-white hover:bg-white/20" onClick={() => setCameraOpen(true)}>
                <Camera /> Cámara
              </Button>
              <Button variant="outline" className="rounded-xl bg-white/10 text-white hover:bg-white/20" onClick={s.pasteFromClipboard}>
                <ClipboardPaste /> Pegar
              </Button>
            </div>
          </div>
        )}

        {corner && <div className="absolute inset-x-3 top-3 z-40 flex justify-between">{corner}</div>}

        {/* Cambiar la foto cuando ya hay una */}
        {s.preview && (
          <div className="absolute right-3 bottom-[15.5rem] z-30 flex gap-1.5">
            <button type="button" title="Explorar" aria-label="Explorar" onClick={() => fileRef.current?.click()} className={ICON_BTN}>
              <FolderOpen className="size-4" />
            </button>
            <button type="button" title="Cámara" aria-label="Cámara" onClick={() => setCameraOpen(true)} className={ICON_BTN}>
              <Camera className="size-4" />
            </button>
            <button type="button" title="Pegar" aria-label="Pegar" onClick={() => s.pasteFromClipboard()} className={ICON_BTN}>
              <ClipboardPaste className="size-4" />
            </button>
          </div>
        )}

        {/* Líneas de los pointers */}
        <svg className="pointer-events-none absolute inset-0 z-10 size-full" width={size.w} height={size.h}>
          {layout
            .filter((l) => !touch || open === l.m.id)
            .map((l) => (
            <line
              key={l.m.id}
              x1={touch ? l.pl + 24 : l.ax}
              y1={touch ? (l.pt < l.py ? l.pt + 52 : l.pt) : l.ay}
              x2={l.px}
              y2={l.py}
              stroke="white"
              strokeOpacity={0.85}
              strokeWidth={1.5}
              style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,.8))" }}
            />
          ))}
        </svg>

        {/* Píldoras de modificadores */}
        {touch &&
          layout
            .filter((l) => open === l.m.id)
            .map((l) => (
              <div
                key={l.m.id}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  pillDrag.current = { id: l.m.id, dx: e.clientX - r.left, dy: e.clientY - r.top };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={movePill}
                onPointerUp={() => (pillDrag.current = null)}
                onPointerCancel={() => (pillDrag.current = null)}
                className="absolute z-40 cursor-grab touch-none select-none rounded-2xl border border-white/25 bg-black/70 p-3 text-white shadow-xl backdrop-blur-md active:cursor-grabbing"
                style={{ left: l.pl, top: l.pt, width: POPUP_W }}
              >
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold tracking-wide text-primary uppercase">
                      {catName(l.m.category_id)}
                    </span>
                    <span className="block text-sm leading-5">{l.m.text}</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Quitar modificador"
                    onClick={() => {
                      setOpen(null);
                      s.toggle(l.m.id);
                    }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 active:bg-primary"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ))}
        {!touch && layout.map((l) => (
          <div
            key={l.m.id}
            className={cn("group absolute z-20 hover:z-40", l.right && "flex justify-end")}
            style={{ top: l.top, [l.right ? "right" : "left"]: l.edge, width: PILL_W }}
          >
            <div
              className={cn(
                "flex w-[152px] items-center gap-1.5 overflow-hidden rounded-[18px] border border-white/25 bg-black/60 px-3 py-2 text-white shadow-lg backdrop-blur-md transition-[width] duration-200 group-hover:w-72 group-hover:items-start",
              )}
              style={{ minHeight: PILL_H }}
            >
              <span className="min-w-0 flex-1">
                <span className="hidden text-[10px] font-semibold tracking-wide text-primary uppercase group-hover:block">
                  {catName(l.m.category_id)}
                </span>
                <span className="block truncate text-xs leading-5 group-hover:whitespace-normal">{l.m.text}</span>
              </span>
              <button
                type="button"
                aria-label="Quitar modificador"
                onClick={() => s.toggle(l.m.id)}
                className="hidden size-5 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-primary group-hover:flex"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Pointers movibles */}
        {layout.map((l) => (
          <button
            key={l.m.id}
            type="button"
            aria-label={`Mover el punto de "${l.m.text}"`}
            title="Arrastra para indicar la zona"
            onPointerDown={(e) => {
              drag.current = l.m.id;
              tap.current = { x: e.clientX, y: e.clientY, moved: false };
              e.currentTarget.setPointerCapture(e.pointerId);
              if (!touch) moveTo(l.m.id, e);
            }}
            onPointerMove={(e) => {
              if (drag.current !== l.m.id) return;
              if (Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 6) tap.current.moved = true;
              if (!touch || tap.current.moved) moveTo(l.m.id, e);
            }}
            onPointerUp={() => {
              // En móvil, un toque (sin arrastrar) abre o cierra el popup del modificador.
              if (touch && !tap.current.moved && drag.current === l.m.id) setOpen((o) => (o === l.m.id ? null : l.m.id));
              drag.current = null;
            }}
            onPointerCancel={() => (drag.current = null)}
            className="absolute z-30 size-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
            style={{ left: l.px, top: l.py }}
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
            <span className="absolute inset-2 rounded-full border-2 border-white bg-primary shadow-[0_0_8px_rgba(0,0,0,.6)]" />
          </button>
        ))}

        {/* Overlay inferior con los controles, siempre fijo abajo */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pt-24 pb-4">
          <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
            <input
              value={s.freeText}
              onChange={(e) => s.setFreeText(e.target.value)}
              maxLength={1000}
              placeholder="Texto adicional (opcional)…"
              aria-label="Texto adicional"
              className="h-11 w-full rounded-xl bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/50 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-primary"
            />
            <div className="flex gap-2">
              <GhostSelect label="Proporción" value={model.ratios.length ? s.ratio : "auto"} onChange={s.setRatio} disabled={model.ratios.length === 0}>
                {model.ratios.length === 0 ? (
                  <option value="auto">Proporción original</option>
                ) : (
                  ["auto", ...model.ratios].map((r) => (
                    <option key={r} value={r}>
                      {r === "auto" ? "Proporción: auto" : r}
                    </option>
                  ))
                )}
              </GhostSelect>
              <GhostSelect label="Modelo" value={s.model} onChange={s.setModel}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </GhostSelect>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="flex-1">
                {s.tokenCost === null
                  ? "Modelo no disponible por ahora"
                  : s.billing?.account.bypass
                    ? "Costo: 0 (modo desarrollo)"
                    : `Costo: ${s.tokenCost} tokens`}
              </span>
              {s.billing && !s.billing.account.bypass && <span>Saldo: {s.billing.account.tokens}</span>}
              {!s.canAfford && (
                <Link href="/cuenta" className="rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground">
                  Recargar
                </Link>
              )}
            </div>
            <Button className="h-12 w-full rounded-2xl text-base" disabled={s.busy || !s.canProcess} onClick={s.process}>
              {s.busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {s.busy
                ? "Procesando… puede tardar un minuto"
                : !s.canAfford
                  ? "Tokens insuficientes"
                  : s.image && s.selected.size === 0
                    ? "Elige al menos un modificador"
                    : "Procesar"}
            </Button>
          </div>
        </div>
      </div>
      <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={s.setImage} />
    </section>
  );
}
