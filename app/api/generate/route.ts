import { fal } from "@fal-ai/client";
import { HttpError, authed, handle } from "@/lib/api";
import { billingBypass } from "@/lib/auth";
import { firstGenerationFree, getPricing, refundUsage, spendTokens } from "@/lib/billing";
import { batch, query, run, uid } from "@/lib/db";
import { extractResultUrl, getModel, resolveRatio } from "@/lib/models";
import { getMode, isMode } from "@/lib/modes";
import { parseRoleList } from "@/lib/material-roles";
import { buildPrompt } from "@/lib/prompt";
import { saveDeduped } from "@/lib/files";
import { FREE_FIRST_MAX_TOKENS, allowedOnFree, tokensFor } from "@/lib/tokens";
import { applyDailyFree, isFreeUser } from "@/lib/free-tier";

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
  const rawMode = form.get("mode");
  const rawPreset = String(form.get("presetId") ?? "");
  const presetId = rawPreset && (await query("SELECT 1 FROM presets WHERE id=? AND user_id=?", [rawPreset, user.id])).length ? rawPreset : null;
  const mode = getMode(isMode(rawMode) ? rawMode : "pro");
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

  // Materiales: imágenes extra (logos, ropa, fondos...) que el modelo incorpora al resultado.
  const materials = form
    .getAll("materials")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, mode.materials ? model.maxMaterials : 0);
  for (const f of materials) {
    if (!f.type.startsWith("image/")) throw new HttpError(400, "Los materiales deben ser imágenes");
    if (f.size > 8 * 1024 * 1024) throw new HttpError(413, "Un material es muy pesado");
  }

  // Estudio Pro: qué categorías tomar de cada material (slugs → nombres de las categorías del usuario).
  const roleSlugs = mode.id === "pro" ? parseRoleList(form.get("materialRoles"), materials.length) : [];
  const usedSlugs = [...new Set(roleSlugs.flat())];
  const cats = usedSlugs.length
    ? await query<{ slug: string; name: string }>(
        `SELECT slug,name FROM categories WHERE user_id=? AND slug IN (${usedSlugs.map(() => "?").join(",")})`,
        [user.id, ...usedSlugs],
      )
    : [];
  const roles = roleSlugs.map((r) => r.map((sl) => cats.find((c) => c.slug === sl)?.name).filter((x): x is string => !!x));

  const ratio = resolveRatio(model, mode.ratio ? String(form.get("aspectRatio") ?? "auto") : "auto");
  const cost = model.cost(ratio).usd;
  const prompt = buildPrompt(mods, freeText, model.kind, materials.length, mode.id, roles);

  // Cobro de tokens antes de gastar en el proveedor; si algo falla después, se devuelven.
  const pricing = await getPricing();
  const tokens = tokensFor(model, ratio, pricing);
  if (tokens === null) throw new HttpError(400, "Este modelo no está disponible por ahora");
  // Tier gratuito: solo modelos económicos, y se aplica el relleno diario antes de cobrar.
  if (!billingBypass()) {
    const isFree = await isFreeUser(user);
    if (isFree && !allowedOnFree(model, ratio, pricing))
      throw new HttpError(402, `${model.label} es parte de los planes de pago. Elige un modelo económico o mejora tu plan en Cuenta.`);
    await applyDailyFree(user, pricing, isFree);
  }
  const id = uid();
  // Primera generación del tutorial: gratis (solo con modelos estándar).
  const free = tokens <= FREE_FIRST_MAX_TOKENS && (await firstGenerationFree(user));
  const charged = billingBypass() || free ? 0 : tokens;
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
      `INSERT INTO generations(id,user_id,model,kind,free_text,prompt,source_file,aspect_ratio,cost_usd,tokens_spent,status,mode,preset_id,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, user.id, model.id, model.kind, freeText || null, prompt, sourceFile, ratio, cost, charged, "processing", mode.id, presetId, Date.now()],
    );
  } catch (e) {
    await refund("Reembolso: no se pudo iniciar la generación");
    throw e;
  }

  try {
    const imageUrl = await fal.storage.upload(new Blob([new Uint8Array(sourceBuf)], { type: image.type || "image/jpeg" }));
    const materialUrls = await Promise.all(materials.map((f) => fal.storage.upload(f)));
    const out = await fal.subscribe(model.endpoint, { input: model.input(prompt, [imageUrl, ...materialUrls], ratio), logs: false });
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
