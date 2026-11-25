// Modos del Studio: misma biblioteca (presets, modificadores, imágenes) aplicada de forma distinta.
// Cada modo define qué categorías de modificadores ofrece, qué controles muestra y la regla que se agrega al prompt.

export type StudioMode = "filtro" | "ocio" | "producto" | "pro";

export type ModeDef = {
  id: StudioMode;
  label: string;
  /** Frase corta para el selector y los slides. */
  tagline: string;
  /** Explicación de una línea (slides de bienvenida). */
  description: string;
  /** Slugs de categorías que se muestran; null = todas. */
  categories: string[] | null;
  /** Permite materiales (imágenes extra). */
  materials: boolean;
  /** Permite elegir proporción; si no, siempre "auto" (conserva la composición). */
  ratio: boolean;
  /** Regla que abre el prompt de imagen. */
  rule: string;
};

export const MODES: ModeDef[] = [
  {
    id: "ocio",
    label: "Ocio",
    tagline: "Diviértete con tus fotos",
    description: "Sube una foto de personas o mascotas y transfórmala en algo divertido: nuevas poses, escenarios, personajes y acciones.",
    categories: null,
    materials: true,
    ratio: true,
    rule:
      "Crea una imagen nueva y divertida a partir de la fotografía de referencia. Las personas o animales deben seguir siendo reconocibles (mismo rostro y rasgos), pero puedes cambiar libremente la pose, la composición, el escenario, la ropa y agregar personajes, objetos o acciones.",
  },
  {
    id: "filtro",
    label: "Filtro",
    tagline: "Mejora tu foto sin cambiarla",
    description: "Sube una selfie o foto de una persona y mejora fondo, luz, destellos, grano o desenfoque sin cambiar la pose, la ropa ni la composición.",
    categories: ["iluminacion", "efectos-de-lente", "fondo-escena", "postproduccion"],
    materials: false,
    ratio: false,
    rule:
      "Mejora esta fotografía sin cambiar su contenido: conserva exactamente la composición, el encuadre, la pose, la expresión, la ropa, el cabello, el rostro y la identidad de la persona o personas. Solo ajusta la iluminación, el fondo, los efectos de lente (destellos, desenfoque, grano) y el acabado de color.",
  },
  {
    id: "producto",
    label: "Producto",
    tagline: "Fotos listas para tu negocio",
    description: "Sube la foto de tu producto o platillo y cambia la luz, el fondo y el ambiente para que quede lista para tu negocio o restaurante.",
    categories: ["iluminacion", "fondo-escena", "encuadre", "efectos-de-lente", "postproduccion"],
    materials: true,
    ratio: true,
    rule:
      "Fotografía profesional de producto. El producto de la imagen de referencia debe quedar idéntico: misma forma, proporciones, materiales, etiqueta, logotipo, textos y colores. Cambia solo la iluminación, el fondo, la superficie y el ambiente para que luzca listo para vender en un negocio o restaurante.",
  },
  {
    id: "pro",
    label: "Estudio Pro",
    tagline: "Control total",
    description: "Combina modificadores de todas las categorías (outfit, pose, fondo, luz…) para crear un resultado nuevo que conserva la identidad del sujeto.",
    categories: null,
    materials: true,
    ratio: true,
    rule: "Edita la fotografía de referencia conservando fielmente la identidad, el rostro y los rasgos de la persona o personas que aparecen.",
  },
];

export const DEFAULT_MODE: StudioMode = "ocio";
export const isMode = (v: unknown): v is StudioMode => MODES.some((m) => m.id === v);
export const getMode = (id: string | null | undefined): ModeDef => MODES.find((m) => m.id === id) ?? MODES.find((m) => m.id === DEFAULT_MODE)!;
/** Presets creados antes de los modos: son del Estudio Pro. */
export const presetMode = (m: string | null | undefined): StudioMode => (isMode(m) ? m : "pro");
export const allowsCategory = (mode: ModeDef, slug: string) => !mode.categories || mode.categories.includes(slug);
