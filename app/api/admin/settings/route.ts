import { z } from "zod";
import { HttpError, adminAuthed, handle } from "@/lib/api";
import { batch } from "@/lib/db";

const schema = z.object({
  usdMxn: z.number().min(1).max(1000),
  margin: z.number().min(1).max(50),
  mxnPerToken: z.number().min(0.01).max(1000),
  analysisTokens: z.number().int().min(0).max(1000),
  signupBonusTokens: z.number().int().min(0).max(100000),
  dailyFreeTokens: z.number().int().min(0).max(100000),
  freeModelMaxTokens: z.number().int().min(0).max(100000),
});

// Parámetros que convierten el costo de cada modelo en tokens.
export const PUT = handle(async (req: Request) => {
  await adminAuthed();
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Revisa los parámetros (tipo de cambio ≥ 1, margen ≥ 1, valor del token > 0)");
  await batch(
    Object.entries(p.data).map(([key, value]) => ({
      sql: "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      args: [key, String(value)],
    })),
  );
  return Response.json({ ok: true });
});
