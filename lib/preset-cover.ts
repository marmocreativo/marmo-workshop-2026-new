import { fal } from "@fal-ai/client";

// Portada automática para presets importados sin imagen: texto a imagen barato y rápido (FLUX schnell, ~US$0.003).
// Devuelve los bytes de la imagen o null si no hay FAL_KEY o el proveedor falla (el preset se importa igual).
const COVER_ENDPOINT = "fal-ai/flux/schnell";

const SUBJECT: Record<string, string> = {
  filtro: "a portrait photo of a person",
  ocio: "a fun creative photo of a person",
  producto: "a professional product photograph of a generic elegant product",
  pro: "a professional editorial photo of a person",
};

export async function generatePresetCover(p: { name: string; mode: string; free_text: string | null; modifiers: { text: string }[] }) {
  if (!process.env.FAL_KEY) return null;
  fal.config({ credentials: process.env.FAL_KEY });
  const details = [p.free_text, ...p.modifiers.map((m) => m.text)].filter(Boolean).join(". ").slice(0, 1200);
  const prompt = `${SUBJECT[p.mode] ?? SUBJECT.pro}, style "${p.name}". ${details}. High quality, no text, no watermark.`;
  try {
    const out = await fal.subscribe(COVER_ENDPOINT, {
      input: { prompt, image_size: "square", num_images: 1, enable_safety_checker: true },
      logs: false,
    });
    const url = (out.data as { images?: { url: string }[] }).images?.[0]?.url;
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return { buf: Buffer.from(await res.arrayBuffer()), ext: res.headers.get("content-type")?.includes("png") ? "png" : "jpg" };
  } catch {
    return null;
  }
}
