import { z } from "zod";

// Formato del archivo de exportación de presets (JSON portable entre cuentas).
// Las imágenes (portada y materiales) viajan como data URL para que el archivo sea autosuficiente.

export const PRESET_FILE_TYPE = "marmo-workshop/presets";
export const PRESET_FILE_VERSION = 1;

const dataUrl = z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Imagen inválida");

export const presetFileSchema = z.object({
  type: z.literal(PRESET_FILE_TYPE),
  version: z.number().int().min(1).max(PRESET_FILE_VERSION),
  presets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        mode: z.enum(["filtro", "ocio", "producto", "pro"]).default("pro"),
        free_text: z.string().max(1000).nullable().default(null),
        instructions: z.string().max(1000).nullable().default(null),
        favorite: z.boolean().default(false),
        modifiers: z
          .array(z.object({ category: z.string().min(1).max(60), category_name: z.string().min(1).max(60), text: z.string().min(1).max(2000) }))
          .max(60)
          .default([]),
        cover: dataUrl.nullable().default(null),
        materials: z
          .array(z.object({ image: dataUrl, roles: z.array(z.string().max(60)).max(10).default([]) }))
          .max(3)
          .default([]),
      }),
    )
    .min(1, "El archivo no tiene presets")
    .max(200, "Máximo 200 presets por archivo"),
});

export type PresetFile = z.infer<typeof presetFileSchema>;

export function decodeDataUrl(url: string): { buf: Buffer; ext: "png" | "jpg" } {
  const [head, b64] = url.split(",", 2);
  return { buf: Buffer.from(b64, "base64"), ext: head.includes("png") ? "png" : "jpg" };
}
