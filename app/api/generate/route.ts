import { fal } from "@fal-ai/client";
import { HttpError, authed, handle } from "@/lib/api";
import { billingBypass } from "@/lib/auth";
import { getPricing, refundUsage, spendTokens } from "@/lib/billing";
import { batch, query, run, uid } from "@/lib/db";
import { extractResultUrl, getModel, resolveRatio } from "@/lib/models";
import { buildPrompt } from "@/lib/prompt";
import { saveDeduped } from "@/lib/files";
import { tokensFor } from "@/lib/tokens";

export const maxDuration = 300;

export const POST = handle(async (req: Request) => {
  const user = await authed();
  if (!process.env.FAL_KEY) throw new HttpError(500, "Falta FAL_KEY en el servidor");
  fal.config({ credentials: process.env.FAL_KEY });

  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof File)) throw new HttpError(400, "Agrega una foto de referencia");
  const model = getModel(String(form.get("model") ?? ""));
  if (!model) throw new HttpError(400, "Modelo no válido");
  const freeText = String(form.get("freeText") ?? "").slice(0, 1000);
  let modifierIds: string[] = [];
  try {
    modifierIds = JSON.parse(String(form.get("modifierIds") ?? "[]"));
  } catch {}
  if (!Array.isArray(modifierIds)) modifierIds = [];

  const mods = modifierIds.length
    ? await query<{ id: string; text: string; category: string }>(
        `SELECT m.id, m.text, c.name AS category FROM modifiers m JOIN categories c ON c.id=m.category_id
         WHERE m.user_id=? AND m.id IN (${modifierIds.map(() => "?").join(",")})`,
        [user.id, ...modifierIds],
      )
    : [];

  if (!mods.length && !freeText.trim()) throw new HttpError(400, "Elige un modificador o escribe el prompt manual");

  const ratio = resolveRatio(model, String(form.get("aspectRatio") ?? "auto"));
  const cost = model.cost(ratio).usd;
  const prompt = buildPrompt(mods, freeText, model.kind);

  // Cobro de tokens antes de gastar en el proveedor; si algo falla después, se devuelven.
  const tokens = tokensFor(model, ratio, await getPricing());
  if (tokens === null) throw new HttpError(400, "Este modelo no está disponible por ahora");
  const id = uid();
  const charged = billingBypass() ? 0 : tokens;
  if (charged > 0) {
    const spent = await spendTokens(user.id, charged, `Generación con ${model.label}`, id);
    if (!spent.ok)
      throw new HttpError(402, `Tokens insuficientes: necesitas ${tokens} y tienes ${spent.balance}. Recarga en Cuenta.`);
  }
  const refund = (why: string) => refundUsage(user.id, charged, why, id).catch(() => {});

  let sourceBuf: Buffer;
  try {
    sourceBuf = Buffer.from(await image.arrayBuffer());
    // Misma imagen que ya usó antes: se reutiliza el archivo (no se duplica en disco ni en la biblioteca).
    const sourceFile = await saveDeduped(user.id, sourceBuf, image.type === "image/png" ? "png" : "jpg");
    await run(
      `INSERT INTO generations(id,user_id,model,kind,free_text,prompt,source_file,aspect_ratio,cost_usd,tokens_spent,status,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, user.id, model.id, model.kind, freeText || null, prompt, sourceFile, ratio, cost, charged, "processing", Date.now()],
    );
  } catch (e) {
    await refund("Reembolso: no se pudo iniciar la generación");
    throw e;
  }

  try {
    const imageUrl = await fal.storage.upload(new Blob([new Uint8Array(sourceBuf)], { type: image.type || "image/jpeg" }));
    const out = await fal.subscribe(model.endpoint, { input: model.input(prompt, imageUrl, ratio), logs: false });
    const resultUrl = extractResultUrl(out.data);
    if (!resultUrl) throw new Error("El modelo no devolvió ningún resultado");

    const res = await fetch(resultUrl);
    if (!res.ok) throw new Error("No se pudo descargar el resultado");
    const ext = model.kind === "video" ? "mp4" : (res.headers.get("content-type")?.includes("png") ? "png" : "jpg");
    const resultFile = await saveDeduped(user.id, Buffer.from(await res.arrayBuffer()), ext);

    await batch([
      { sql: "UPDATE generations SET status='done', result_file=? WHERE id=?", args: [resultFile, id] },
      ...mods.map((m) => ({
        sql: "INSERT OR IGNORE INTO generation_modifiers(generation_id,modifier_id,text) VALUES(?,?,?)",
        args: [id, m.id, m.text],
      })),
      ...mods.map((m) => ({ sql: "UPDATE modifiers SET usage_count=usage_count+1 WHERE id=?", args: [m.id] })),
    ]);
    return Response.json({ id, resultFile, kind: model.kind, tokensSpent: charged });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al generar";
    await run("UPDATE generations SET status='error', error=?, tokens_spent=0 WHERE id=?", [message, id]);
    await refund("Reembolso: la generación falló");
    throw new HttpError(502, `${message}${charged ? " (tus tokens fueron devueltos)" : ""}`);
  }
});
