import {
  Aperture, Clock, Crop, Flame, Glasses, Image as ImageIcon, LayoutGrid, Lightbulb, Mountain, PersonStanding,
  Scissors, Shirt, Star, Tag, WandSparkles, type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/types";

// Iconos de Lucide (licencia ISC, libres de uso) para cada categoría; las personalizadas usan una etiqueta.
const BY_SLUG: Record<string, LucideIcon> = {
  "tipo-de-imagen": ImageIcon,
  iluminacion: Lightbulb,
  "pose-accion": PersonStanding,
  encuadre: Crop,
  "efectos-de-lente": Aperture,
  outfit: Shirt,
  cabello: Scissors,
  accesorios: Glasses,
  "fondo-escena": Mountain,
  postproduccion: WandSparkles,
  // Filtros especiales del selector
  all: LayoutGrid,
  new: Clock,
  favs: Star,
  top: Flame,
};

export function CategoryIcon({ slug, className }: { slug?: string | null; className?: string }) {
  const Icon = (slug && BY_SLUG[slug]) || Tag;
  return <Icon className={className ?? "size-4"} aria-hidden />;
}

/** Busca el icono por id de categoría (o por clave de filtro especial). */
export function categorySlug(categories: Category[], idOrKey: string) {
  return categories.find((c) => c.id === idOrKey)?.slug ?? idOrKey;
}
