export function buildPrompt(
  mods: { category: string; text: string }[],
  freeText: string,
  kind: "image" | "video",
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
  if (freeText.trim()) lines.push(`Indicaciones adicionales: ${freeText.trim()}`);
  lines.push("Resultado fotorrealista, de alta calidad, sin marcas de agua.");
  return lines.join("\n");
}
