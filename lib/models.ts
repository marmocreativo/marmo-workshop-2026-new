export type Cost = { usd: number; upTo?: boolean };

export type ModelDef = {
  id: string;
  label: string;
  provider: string;
  endpoint: string;
  kind: "image" | "video";
  /** Proporciones que acepta el modelo (sin "auto"). Vacío = conserva la de la foto de referencia. */
  ratios: string[];
  input: (prompt: string, imageUrl: string, ratio: string) => Record<string, unknown>;
  /** Costo estimado por generación en USD (precios publicados por fal.ai; revisarlos de vez en cuando). */
  cost: (ratio: string) => Cost;
};

const NANO_RATIOS = ["1:1", "4:5", "3:4", "2:3", "9:16", "5:4", "4:3", "3:2", "16:9", "21:9"];

// Seedream recibe tamaño en píxeles; apuntamos a ~2 MP (como 1920×1080) para una calidad buena.
function seedreamSize(ratio: string) {
  const [a, b] = ratio.split(":").map(Number);
  const h = Math.sqrt((2_073_600 * b) / a);
  const round = (n: number) => Math.min(4096, Math.max(960, Math.round(n / 8) * 8));
  return { width: round((h * a) / b), height: round(h) };
}

const GPT_SIZES: Record<string, string> = { "1:1": "1024x1024", "3:2": "1536x1024", "2:3": "1024x1536" };

// Los endpoints viven en fal.ai; si alguno cambia de nombre o de precio, se ajusta solo aquí.
export const MODELS: ModelDef[] = [
  {
    id: "nano-banana",
    label: "Nano Banana",
    provider: "Google",
    endpoint: "fal-ai/nano-banana/edit",
    kind: "image",
    ratios: NANO_RATIOS,
    input: (prompt, url, ratio) => ({ prompt, image_urls: [url], num_images: 1, aspect_ratio: ratio }),
    cost: () => ({ usd: 0.0398 }),
  },
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "Google",
    endpoint: "fal-ai/nano-banana-pro/edit",
    kind: "image",
    ratios: NANO_RATIOS,
    input: (prompt, url, ratio) => ({ prompt, image_urls: [url], num_images: 1, aspect_ratio: ratio }),
    cost: () => ({ usd: 0.15 }), // 1K/2K; 4K costaría el doble
  },
  {
    id: "seedream",
    label: "Seedream 4",
    provider: "ByteDance",
    endpoint: "fal-ai/bytedance/seedream/v4/edit",
    kind: "image",
    ratios: ["1:1", "4:5", "3:4", "2:3", "9:16", "5:4", "4:3", "3:2", "16:9", "21:9"],
    input: (prompt, url, ratio) => ({
      prompt,
      image_urls: [url],
      num_images: 1,
      ...(ratio === "auto" ? {} : { image_size: seedreamSize(ratio) }),
    }),
    // $0.03 por megapíxel de salida
    cost: (ratio) => {
      if (ratio === "auto") return { usd: 0.03 };
      const { width, height } = seedreamSize(ratio);
      return { usd: 0.03 * ((width * height) / 1_000_000) };
    },
  },
  {
    id: "gpt-image",
    label: "GPT Image",
    provider: "OpenAI",
    endpoint: "fal-ai/gpt-image-1.5/edit",
    kind: "image",
    ratios: Object.keys(GPT_SIZES),
    input: (prompt, url, ratio) => ({
      prompt,
      image_urls: [url],
      num_images: 1,
      image_size: GPT_SIZES[ratio] ?? "auto",
    }),
    // Calidad por defecto del modelo: se muestra el tope (alta).
    cost: (ratio) => ({ usd: ratio === "1:1" ? 0.133 : 0.2, upTo: true }),
  },
  {
    id: "grok",
    label: "Grok Imagine",
    provider: "xAI",
    endpoint: "xai/grok-imagine-image/edit",
    kind: "image",
    ratios: [],
    input: (prompt, url) => ({ prompt, image_url: url }),
    cost: () => ({ usd: 0.022 }),
  },
  {
    id: "seedance",
    label: "Seedance (video)",
    provider: "ByteDance",
    endpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    kind: "video",
    ratios: [],
    input: (prompt, url) => ({ prompt, image_url: url }),
    cost: () => ({ usd: 0.62 }), // clip de 5 s a 1080p
  },
];

export const getModel = (id: string) => MODELS.find((m) => m.id === id);

/** Devuelve la proporción válida para el modelo ("auto" si no la soporta). */
export const resolveRatio = (model: ModelDef, ratio: string) => (model.ratios.includes(ratio) ? ratio : "auto");

export function formatCost({ usd, upTo }: Cost) {
  const n = usd < 0.1 ? usd.toFixed(3) : usd.toFixed(2);
  return `${upTo ? "hasta " : "≈ "}US$${n}`;
}

export function extractResultUrl(data: unknown): string | null {
  const d = data as {
    images?: { url?: string }[];
    image?: { url?: string };
    video?: { url?: string };
  };
  return d?.images?.[0]?.url ?? d?.image?.url ?? d?.video?.url ?? null;
}

// Icono (public/icons) de cada modelo.
const ICONS: Record<string, string> = {
  "nano-banana": "bannana",
  "nano-banana-pro": "bannana",
  seedream: "seedream",
  "gpt-image": "gpt",
  grok: "grok",
  seedance: "seedance",
};
export const modelIcon = (id: string) => `/icons/${ICONS[id] ?? "bannana"}.webp`;
