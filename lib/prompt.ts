import { getMode, type StudioMode } from "./modes";

/**
 * roles[i] = nombres de las categorías que se toman de la imagen extra i (Estudio Pro: "solo el outfit", "solo el fondo"...).
 * Una imagen sin roles es un material libre (logo, prenda, objeto) que se incorpora al resultado.
 */
export function buildPrompt(
  mods: { category: string; text: string }[],
  freeText: string,
  kind: "image" | "video",
  materials = 0,
  mode: StudioMode = "pro",
  roles: string[][] = [],
) {
  const lines: string[] = [
    kind === "video"
      ? "Anima la persona o personas de la imagen de referencia, conservando su identidad, rostro y rasgos exactos."
      : getMode(mode).rule,
  ];
  if (mods.length) {
    lines.push("Aplica estas modificaciones:");
    for (const m of mods) lines.push(`- ${m.category}: ${m.text}`);
  }
  if (materials > 0) {
    lines.push("La imagen 1 es la fotografía principal del sujeto.");
    const free: number[] = [];
    for (let i = 0; i < materials; i++) {
      const r = roles[i] ?? [];
      if (r.length)
        lines.push(
          `La imagen ${i + 2} es una referencia de ${r.join(", ").toLowerCase()}: toma de ella únicamente ${r.length > 1 ? "esos elementos" : "ese elemento"} y aplícalo${r.length > 1 ? "s" : ""} al sujeto de la imagen 1. Ignora todo lo demás de esa imagen, incluidas las personas que aparezcan en ella.`,
        );
      else free.push(i + 2);
    }
    if (free.length)
      lines.push(
        `${free.length === 1 ? `La imagen ${free[0]} es un material` : `Las imágenes ${free.join(", ")} son materiales`} adicional(es) (logotipos, prendas, fondos u objetos): incorpóralos de forma natural al resultado final según las modificaciones e indicaciones.`,
      );
  }
  if (freeText.trim()) lines.push(`Indicaciones adicionales: ${freeText.trim()}`);
  lines.push("Resultado fotorrealista, de alta calidad, sin marcas de agua.");
  return lines.join("\n");
}
