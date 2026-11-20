"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Trash2, Upload } from "lucide-react";
import { confirmAction, toast } from "@/lib/alerts";
import { Button } from "@/components/ui/button";
import { api, jsonBody } from "@/lib/client";
import { cn } from "@/lib/utils";

type Img = { id: string; sort: number; active: number };

// Imágenes del slider del Home: se suben, se ordenan y se pueden ocultar sin borrarlas.
export function HeroAdmin() {
  const [images, setImages] = useState<Img[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => setImages((await api<{ images: Img[] }>("/api/admin/hero")).images), []);
  useEffect(() => {
    api<{ images: Img[] }>("/api/admin/hero")
      .then((r) => setImages(r.images))
      .catch((e) => toast.error((e as Error).message));
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      [...files].forEach((f) => form.append("image", f));
      await api("/api/admin/hero", { method: "POST", body: form });
      await load();
      toast.success(files.length > 1 ? "Imágenes agregadas" : "Imagen agregada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: { active?: boolean; move?: "up" | "down" }) {
    try {
      await api(`/api/admin/hero/${id}`, { method: "PATCH", body: jsonBody(body) });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!(await confirmAction("Se borra del slider y del disco.", { title: "¿Eliminar esta imagen?", confirmText: "Eliminar", danger: true }))) return;
    try {
      await api(`/api/admin/hero/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Slider del Home</h2>
          <p className="text-sm text-muted-foreground">
            Se muestran en orden, solo las activas. Mejor verticales o 4:5, de al menos 1600 px de alto (JPG, PNG o WebP, máx. 8 MB).
            Si no hay ninguna activa, el Home usa la imagen fija.
          </p>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <Button disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} Subir imágenes
        </Button>
      </div>

      {images === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : images.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-14 text-center text-sm text-muted-foreground">Aún no hay imágenes en el slider.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {images.map((im, i) => (
            <li key={im.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="relative aspect-[4/5] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/public/hero/${im.id}`} alt="" loading="lazy" className={cn("size-full object-cover", !im.active && "opacity-40 grayscale")} />
                <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">{i + 1}</span>
              </div>
              <div className="flex items-center justify-between p-2">
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="outline" aria-label="Mover antes" disabled={i === 0} onClick={() => patch(im.id, { move: "up" })}>
                    <ArrowLeft />
                  </Button>
                  <Button size="icon-sm" variant="outline" aria-label="Mover después" disabled={i === images.length - 1} onClick={() => patch(im.id, { move: "down" })}>
                    <ArrowRight />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="outline" aria-label={im.active ? "Ocultar" : "Mostrar"} title={im.active ? "Ocultar del slider" : "Mostrar en el slider"} onClick={() => patch(im.id, { active: !im.active })}>
                    {im.active ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button size="icon-sm" variant="outline" aria-label="Eliminar" onClick={() => remove(im.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
