export function buildPrompt(
  mods: { category: string; text: string }[],
  freeText: string,
  kind: "image" | "video",
  materials = 0,
) {
  const lines: string[] = [
    kind === "video"
      ? "Anima la persona o personas de la imagen de referencia, conservando su identidad, rostro y rasgos exactos."
      : "Edita la fotografía de referencia conservando fielmente la identidad, el rostro y los rasgos de la persona o personas que aparecen.",
  ];
  if (mods.length) {
    lines.push("Aplica estas modificaciones:");
    for (const m of mods) lines.push(`- ${m.category}: ${m.text}`);
  }
  if (materials > 0)
    lines.push(
      `La primera imagen es la fotografía de referencia. ${materials === 1 ? "La imagen 2 es un material" : `Las imágenes 2 a ${materials + 1} son materiales`} adicional(es) (logotipos, prendas, fondos u objetos): incorpóralos de forma natural al resultado final según las modificaciones e indicaciones.`,
    );
  if (freeText.trim()) lines.push(`Indicaciones adicionales: ${freeText.trim()}`);
  lines.push("Resultado fotorrealista, de alta calidad, sin marcas de agua.");
  return lines.join("\n");
}
