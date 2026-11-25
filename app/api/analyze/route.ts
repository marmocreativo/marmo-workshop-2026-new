import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { billingBypass } from "@/lib/auth";
import { getPricing, refundUsage, spendTokens } from "@/lib/billing";
import { query, uid } from "@/lib/db";
import { allowsCategory, getMode, isMode, type StudioMode } from "@/lib/modes";
import type { Category } from "@/lib/types";

export const maxDuration = 60;

// Registro (tono) de redacción por categoría. Las categorías que no aparecen aquí usan un lenguaje visual neutro.
const CINE =
  "Redáctalo con el lenguaje técnico de un director de fotografía / cineasta profesional: vocabulario de set y de cámara (key light, fill, contraluz, ratio de contraste, temperatura de color en kelvin, dirección y calidad de la luz, ángulo y tipo de plano, distancia focal, apertura, profundidad de campo, bokeh, anamórfico, grano, gradación de color, LUT, contraste y curva tonal).";
const MODA =
  "Redáctalo con el lenguaje de un editor de moda editorial: nombra siluetas, cortes, telas y texturas, estampados, paleta de color, capas y styling, y la estética de la prenda (p. ej. sastrería oversize, minimalismo, quiet luxury, streetwear), como en un styling de revista.";
const TONES: Record<string, string> = {
  iluminacion: CINE,
  encuadre: CINE,
  "efectos-de-lente": CINE,
  postproduccion: CINE,
  outfit: MODA,
};

// Enfoque del análisis según el modo del Studio: qué se extrae de la imagen y para qué se va a reutilizar.
const FOCUS: Record<StudioMode, string> = {
  filtro:
    "OBJETIVO: copiar el LOOK de esta foto como un filtro que se aplicará a OTRA foto sin cambiar su contenido. Describe solo cómo se ve, no qué hay: calidad, dirección y color de la luz; efectos de lente (desenfoque, bokeh, destellos, viñeta, aberración); tratamiento del fondo como ambiente (color, desenfoque, atmósfera), nunca objetos concretos; y postproducción (gradación de color, contraste, curva tonal, grano, tono de piel). NO describas personas, ropa, pose, encuadre ni objetos.",
  producto:
    "OBJETIVO: copiar la PUESTA EN ESCENA de esta fotografía de producto para aplicarla a OTRO producto. Describe la iluminación de estudio, el fondo, la superficie, los props y elementos de ambientación, el encuadre y ángulo, la lente y la postproducción. NO describas el producto en sí (su forma, marca, etiqueta, texto ni colores propios): solo el entorno y cómo está fotografiado.",
  ocio:
    "OBJETIVO: capturar el CONCEPTO divertido de esta imagen para recrearlo con otras personas o mascotas. Prioriza la idea y la escena: tipo de imagen o estilo (revista, póster de película, ilustración, figura de juguete…), escenario, acción o pose, vestuario y accesorios característicos, y el ambiente. Sé creativo y evocador; el resultado puede cambiar por completo la foto original.",
  pro:
    "OBJETIVO: descomponer la imagen en modificadores técnicos y precisos de todas las categorías, para combinarlos y mezclarlos con control total. Sé detallado y profesional en cada elemento.",
};

const itemSchema = z.object({ category: z.string(), text: z.string() });
// Respuesta: {name, items} (nombre sugerido para un preset) o, por compatibilidad, solo el arreglo.
const outSchema = z.union([z.object({ name: z.string().optional(), items: z.array(itemSchema) }), z.array(itemSchema)]);

// Analiza una imagen con Gemini y devuelve modificadores sugeridos por categoría.
export const POST = handle(async (req: Request) => {
  const user = await authed();
  if (!process.env.GEMINI_API_KEY) throw new HttpError(500, "Falta GEMINI_API_KEY en el servidor");

  const form = await req.formData();
  const file = form.get("image");
  const rawMode = form.get("mode");
  const mode = getMode(isMode(rawMode) ? rawMode : "pro");
  if (!(file instanceof File)) throw new HttpError(400, "Falta la imagen");
  if (file.size > 12 * 1024 * 1024) throw new HttpError(413, "La imagen es muy pesada (máx. 12 MB)");

  // Cobro de tokens; si el análisis falla, se devuelven.
  const charged = billingBypass() ? 0 : (await getPricing()).analysisTokens;
  const ref = uid();
  if (charged > 0) {
    const spent = await spendTokens(user.id, charged, "Análisis de imagen", ref);
    if (!spent.ok)
      throw new HttpError(402, `Tokens insuficientes: necesitas ${charged} y tienes ${spent.balance}. Recarga en Cuenta.`);
  }
  try {
    return await analyze(file);
  } catch (e) {
    await refundUsage(user.id, charged, "Reembolso: el análisis falló", ref).catch(() => {});
    throw e;
  }

  async function analyze(file: File) {
  // Solo las categorías que usa el modo (p. ej. Filtro no analiza ropa ni pose).
  const categories = (await query<Category>("SELECT id,slug,name,sort FROM categories WHERE user_id=? ORDER BY sort", [user.id])).filter((c) =>
    allowsCategory(mode, c.slug),
  );
  const catList = categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n");
  const toneList = categories
    .filter((c) => TONES[c.slug])
    .map((c) => `- ${c.slug}: ${TONES[c.slug]}`)
    .join("\n");

  const prompt = `Analiza esta fotografía y describe por separado sus elementos visuales como modificadores reutilizables para generar otras imágenes.
Categorías disponibles (usa exactamente el slug):
${catList}

${FOCUS[mode.id]}

Reglas:
- Devuelve un objeto JSON {"name": "<nombre corto y atractivo para un preset con este estilo, 2 a 4 palabras en español>", "items": [{"category": "<slug>", "text": "<descripción>"}]}.
- Una descripción por categoría que aplique a la imagen; omite las que no se vean.
- Cada texto en español, concreto y visual (40 palabras máximo), usable como instrucción de edición. Usa terminología profesional, no descripciones genéricas.
- NO describas la identidad, nombre ni rasgos faciales de las personas.
${toneList ? `\nRegistro de redacción por categoría (cada una tiene su propio tono; en las demás usa un lenguaje visual claro y concreto):\n${toneList}` : ""}`;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: file.type || "image/jpeg", data: Buffer.from(await file.arrayBuffer()).toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  });

  let parsed;
  try {
    parsed = outSchema.parse(JSON.parse(res.text ?? "[]"));
  } catch {
    throw new HttpError(502, "Gemini devolvió una respuesta que no se pudo leer. Intenta de nuevo.");
  }

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  const name = Array.isArray(parsed) ? "" : (parsed.name ?? "").trim().slice(0, 60);
  const suggestions = items
    .filter((s) => bySlug.has(s.category) && s.text.trim())
    .map((s) => ({ categoryId: bySlug.get(s.category)!.id, text: s.text.trim() }));
  return Response.json({ suggestions, name, mode: mode.id, tokensSpent: charged });
  }
});
