"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const N = 10; // puntos del contorno de la mancha
const DURATION = 2200; // ms de la transición
const HOLD = 6500; // ms que se queda cada imagen
// Desde dónde brota la mancha en cada cambio (fracciones del recuadro).
const ORIGINS: [number, number][] = [
  [0.78, 0.62],
  [0.3, 0.4],
  [0.7, 0.2],
  [0.45, 0.85],
];

// Contorno orgánico: círculo deformado por ondas que cambian con el tiempo, suavizado con curvas Catmull-Rom.
function blobPath(cx: number, cy: number, R: number, t: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + 0.2 * Math.sin(a * 3 + t * 2.2) + 0.11 * Math.sin(a * 2 - t * 3.1) + 0.06 * Math.sin(a * 5 + t * 1.7);
    pts.push([cx + Math.cos(a) * R * wob * 0.85, cy + Math.sin(a) * R * wob]);
  }
  let d = `M${pts[0][0].toFixed(4)},${pts[0][1].toFixed(4)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(4)},${c1[1].toFixed(4)} ${c2[0].toFixed(4)},${c2[1].toFixed(4)} ${p2[0].toFixed(4)},${p2[1].toFixed(4)}`;
  }
  return d + "Z";
}

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const imgClass = "absolute inset-0 size-full object-cover object-[85%_center]";

// Slider de imágenes: cada cambio brota desde un punto como una mancha líquida (no es un fundido).
export function HeroSlider({ images }: { images: string[] }) {
  const clipId = "hero-" + useId().replace(/:/g, "");
  const [cur, setCur] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const many = images.length > 1;

  // Precarga para que el cambio nunca espere a la red.
  useEffect(() => {
    images.forEach((src) => {
      const i = new Image();
      i.src = src;
    });
  }, [images]);

  // Espera y programa el siguiente cambio.
  useEffect(() => {
    if (!many || next !== null) return;
    const t = setTimeout(() => {
      const [cx, cy] = ORIGINS[cur % ORIGINS.length];
      pathRef.current?.setAttribute("d", blobPath(cx, cy, 0, 0)); // arranca invisible
      const target = (cur + 1) % images.length;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setCur(target);
      else setNext(target);
    }, HOLD);
    return () => clearTimeout(t);
  }, [cur, next, many, images.length]);

  // Anima la mancha creciendo hasta cubrir todo el recuadro.
  useLayoutEffect(() => {
    if (next === null) return;
    const [cx, cy] = ORIGINS[cur % ORIGINS.length];
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      const e = ease(p);
      pathRef.current?.setAttribute("d", blobPath(cx, cy, e * 1.45, (now - start) / 1000));
      if (topRef.current) topRef.current.style.transform = `scale(${1.12 - 0.12 * e})`;
      if (p < 1) raf = requestAnimationFrame(frame);
      else {
        setCur(next);
        setNext(null);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [next, cur]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path ref={pathRef} d="M0,0" />
          </clipPath>
        </defs>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[cur]} alt="" fetchPriority="high" className={imgClass} />
      {next !== null && (
        <div className="absolute inset-0" style={{ clipPath: `url(#${clipId})` }}>
          <div ref={topRef} className="absolute inset-0 origin-center" style={{ transform: "scale(1.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[next]} alt="" className={imgClass} />
          </div>
        </div>
      )}
    </div>
  );
}
