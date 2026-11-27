import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { billingBypass } from "@/lib/auth";
import { getPricing, refundUsage, spendTokens } from "@/lib/billing";
import { query, uid } from "@/lib/db";
import { generatePresetCover } from "@/lib/preset-cover";

export const maxDuration = 120;

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  mode: z.enum(["filtro", "ocio", "producto", "pro"]),
  freeText: z.string().max(1000).default(""),
  modifierIds: z.array(z.string()).max(60).default([]),
});

// Genera una portada con IA a partir del estado actual del editor de presets. Devuelve la imagen (no la guarda:
// queda como portada pendiente y se guarda con el preset). Cuesta lo mismo que un análisis.
export const POST = handle(async (req: Request) => {
  const user = await authed();
  if (!process.env.FAL_KEY) throw new HttpError(500, "Falta FAL_KEY en el servidor");
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Ponle un nombre al preset antes de generar la portada");
  const { name, mode, freeText, modifierIds } = p.data;
  const modifiers = modifierIds.length
    ? await query<{ text: string }>(`SELECT text FROM modifiers WHERE user_id=? AND id IN (${modifierIds.map(() => "?").join(",")})`, [
        user.id,
        ...modifierIds,
      ])
    : [];

  const ref = uid();
  const cost = billingBypass() ? 0 : (await getPricing()).analysisTokens;
  if (cost > 0) {
    const spent = await spendTokens(user.id, cost, "Portada de preset con IA", ref);
    if (!spent.ok) throw new HttpError(402, `Tokens insuficientes: necesitas ${cost} y tienes ${spent.balance}.`);
  }
  const img = await generatePresetCover({ name, mode, free_text: freeText || null, modifiers });
  if (!img) {
    await refundUsage(user.id, cost, "Reembolso: no se pudo generar la portada", ref).catch(() => {});
    throw new HttpError(502, "No se pudo generar la portada, intenta de nuevo");
  }
  return new Response(new Uint8Array(img.buf), {
    headers: { "Content-Type": img.ext === "png" ? "image/png" : "image/jpeg", "X-Tokens-Spent": String(cost) },
  });
});
