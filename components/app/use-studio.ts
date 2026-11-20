"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/alerts";
import { api, fileUrl, jsonBody, resizeImage } from "@/lib/client";
import { useRouter } from "next/navigation";
import { MODELS, getModel, resolveRatio } from "@/lib/models";
import { tokensFor } from "@/lib/tokens";
import type { Generation, Preset } from "@/lib/types";
import type { BillingMe } from "./billing-panel";
import { emitBalance, requestBalanceRefresh } from "@/lib/balance";
import { useLibrary } from "./use-library";

export type ReusePart = "reference" | "result" | "modifiers" | "text" | "model";

type GenerateResult = { id: string; resultFile: string; kind: "image" | "video" };

// Estado y acciones del Studio, compartidos entre la vista móvil y la de escritorio.
export function useStudio(initialRef?: string) {
  const library = useLibrary();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [ratioChoice, setRatio] = useState("auto");
  // Si el modelo elegido no soporta la proporción, se usa "auto".
  const ratio = resolveRatio(getModel(model) ?? MODELS[0], ratioChoice);
  const router = useRouter();
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const balRef = useRef(0); // saldo más reciente, para descontar varias peticiones seguidas sin esperar el render
  const loadBilling = useCallback(async () => {
    const b = await api<BillingMe>("/api/billing/me");
    balRef.current = b.account.tokens;
    setBilling(b);
  }, []);
  useEffect(() => {
    loadBilling().catch(() => {});
  }, [loadBilling]);
  // El saldo se mantiene en vivo: cualquier cambio anunciado (cobro, devolución, Stripe) llega aquí.
  useEffect(() => {
    const onSet = (e: Event) => {
      const tokens = (e as CustomEvent<number>).detail;
      balRef.current = tokens;
      setBilling((b) => (b ? { ...b, account: { ...b.account, tokens } } : b));
    };
    window.addEventListener("mw:balance", onSet);
    return () => window.removeEventListener("mw:balance", onSet);
  }, []);
  // Costo en tokens de la generación elegida (null = modelo deshabilitado por el administrador).
  const modelDef = getModel(model);
  const tokenCost = billing && modelDef ? tokensFor(modelDef, ratio, billing.pricing) : null;
  const canAfford = !billing || billing.account.bypass || (tokenCost !== null && billing.account.tokens >= tokenCost);
  // Se pueden lanzar varias peticiones a la vez: `pending` cuenta las que siguen en proceso.
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  // Resultados nuevos que el usuario aún no ha abierto (la galería los marca con una pulsación).
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [gens, setGens] = useState<Generation[]>([]);
  const [openId, setOpenIdRaw] = useState<string | null>(null);
  const setOpenId = useCallback((id: string | null) => {
    setOpenIdRaw(id);
    if (id) setFresh((f) => (f.has(id) ? new Set([...f].filter((x) => x !== id)) : f));
  }, []);

  const loadGens = useCallback(async () => {
    const r = await api<{ generations: Generation[] }>("/api/generations");
    setGens(r.generations);
  }, []);

  useEffect(() => {
    loadGens().catch(() => {});
  }, [loadGens]);

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // Pegar una imagen desde el portapapeles (Ctrl/Cmd+V) en cualquier parte del Studio.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return; // un popup abierto (p. ej. el analizador) lo maneja
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) {
        setImage(f);
        toast.success("Imagen pegada");
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const toggle = useCallback(
    (id: string) =>
      setSelected((s) => {
        const n = new Set(s);
        if (!n.delete(id)) n.add(id);
        return n;
      }),
    [],
  );

  // Tras guardar modificadores nuevos (p. ej. del análisis de una imagen), los recarga y los aplica a la foto.
  const applyCreated = useCallback(
    async (created?: { id: string }[]) => {
      await library.refresh();
      if (created?.length) setSelected((s) => new Set([...s, ...created.map((m) => m.id)]));
    },
    [library],
  );

  const clearSelected = useCallback(() => setSelected(new Set()), []);

  const chosen = useMemo(() => library.modifiers.filter((m) => selected.has(m.id)), [library.modifiers, selected]);

  async function pasteFromClipboard() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          setImage(new File([await item.getType(type)], "pegada.png", { type }));
          return toast.success("Imagen pegada");
        }
      }
      toast.error("No hay ninguna imagen en el portapapeles");
    } catch {
      toast.error("No pude leer el portapapeles. Prueba con Ctrl+V.");
    }
  }

  async function useStoredFile(name: string) {
    try {
      const blob = await (await fetch(fileUrl(name))).blob();
      setImage(new File([blob], name, { type: blob.type || "image/jpeg" }));
    } catch {
      toast.error("No pude cargar esa imagen");
    }
  }

  // Llegar desde Comunidad con ?ref=archivo carga esa imagen como foto a editar.
  useEffect(() => {
    if (initialRef) useStoredFile(initialRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRef]);

  async function process() {
    if (!image) return toast.error("Primero agrega una foto");
    if (selected.size === 0) return toast.error("Elige al menos un modificador");
    setPending((n) => n + 1);
    // El servidor cobra al recibir la petición: se refleja de inmediato y luego se reconcilia con el saldo real.
    if (billing && !billing.account.bypass && tokenCost) emitBalance(Math.max(0, balRef.current - tokenCost));
    try {
      const form = new FormData();
      form.set("image", await resizeImage(image));
      form.set("model", model);
      form.set("aspectRatio", ratio);
      form.set("freeText", freeText);
      form.set("modifierIds", jsonBody([...selected]));
      const out = await api<GenerateResult>("/api/generate", { method: "POST", body: form });
      setResult(out);
      await Promise.all([loadGens(), library.refresh()]).catch(() => {});
      setFresh((f) => new Set(f).add(out.id)); // sin abrir el modal: la galería pulsa para avisar
    } catch (e) {
      toast.error((e as Error).message);
      loadGens().catch(() => {});
    } finally {
      setPending((n) => Math.max(0, n - 1));
      loadBilling().catch(() => {});
      requestBalanceRefresh(); // saldo real (por si hubo devolución)
      router.refresh();
    }
  }

  async function deleteGen(id: string) {
    try {
      await api(`/api/generations/${id}`, { method: "DELETE" });
      setGens((all) => all.filter((g) => g.id !== id));
      toast.success("Resultado eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setVisibility(g: Generation, patch: { isPublic?: boolean; sourcePublic?: boolean }) {
    setGens((all) =>
      all.map((x) =>
        x.id === g.id
          ? {
              ...x,
              is_public: patch.isPublic === undefined ? x.is_public : +patch.isPublic,
              source_public: patch.sourcePublic === undefined ? x.source_public : +patch.sourcePublic,
            }
          : x,
      ),
    );
    try {
      await api(`/api/generations/${g.id}`, { method: "PATCH", body: jsonBody(patch) });
    } catch (e) {
      toast.error((e as Error).message);
      loadGens().catch(() => {});
    }
  }

  // Borrado suave de la imagen de referencia: la oculta de la biblioteca o la restaura.
  async function setSourceDeleted(id: string, deleted: boolean) {
    const at = deleted ? Date.now() : null;
    setGens((all) => all.map((g) => (g.id === id ? { ...g, source_deleted_at: at, source_public: deleted ? 0 : g.source_public } : g)));
    try {
      await api(`/api/generations/${id}`, { method: "PATCH", body: jsonBody({ sourceDeleted: deleted }) });
      toast.success(deleted ? "Imagen quitada de la biblioteca" : "Imagen restaurada");
    } catch (e) {
      toast.error((e as Error).message);
      loadGens().catch(() => {});
    }
  }

  // Presets: solo modificadores + texto extra (la imagen es una portada y no se carga como foto).
  function applyPreset(p: Preset) {
    const alive = new Set(library.modifiers.map((m) => m.id));
    const ids = p.modifier_ids.filter((id) => alive.has(id));
    setSelected(new Set(ids));
    setFreeText(p.free_text ?? "");
    if (ids.length < p.modifier_ids.length) toast.message("Algunos modificadores del preset ya no existen");
    toast.success(`Preset "${p.name}" aplicado`);
  }

  async function savePreset(name: string, withImage: boolean) {
    const form = new FormData();
    form.set("name", name);
    form.set("freeText", freeText);
    form.set("modifierIds", jsonBody([...selected]));
    if (withImage && image) form.set("image", await resizeImage(image, 640));
    await api("/api/presets", { method: "POST", body: form });
    await library.refresh();
    toast.success("Preset guardado");
  }

  async function savePresetFromGeneration(generationId: string, name: string) {
    const form = new FormData();
    form.set("name", name);
    form.set("generationId", generationId);
    await api("/api/presets", { method: "POST", body: form });
    await library.refresh();
    toast.success("Preset guardado");
  }

  async function setPresetPublic(id: string, isPublic: boolean) {
    try {
      await api(`/api/presets/${id}`, { method: "PATCH", body: jsonBody({ isPublic }) });
      await library.refresh();
      toast.success(isPublic ? "Preset público: otros usuarios podrán guardarlo" : "Preset privado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deletePreset(id: string) {
    try {
      await api(`/api/presets/${id}`, { method: "DELETE" });
      await library.refresh();
      toast.success("Preset eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reuse(g: Generation, parts: ReusePart[]) {
    if (parts.includes("reference") && g.source_file) await useStoredFile(g.source_file);
    if (parts.includes("result") && g.result_file && g.kind === "image") await useStoredFile(g.result_file);
    if (parts.includes("modifiers")) {
      const alive = new Set(library.modifiers.map((m) => m.id));
      const ids = g.modifiers.map((m) => m.modifier_id).filter((id) => alive.has(id));
      setSelected(new Set(ids));
      if (ids.length < g.modifiers.length) toast.message("Algunos modificadores ya no están en tu biblioteca");
    }
    if (parts.includes("text")) setFreeText(g.free_text ?? "");
    if (parts.includes("model") && MODELS.some((m) => m.id === g.model)) {
      setModel(g.model);
      if (g.aspect_ratio) setRatio(g.aspect_ratio);
    }
    toast.success("Listo, ya está en el editor");
  }

  return {
    ...library,
    image,
    setImage,
    preview,
    selected,
    setSelected,
    toggle,
    applyCreated,
    clearSelected,
    chosen,
    freeText,
    setFreeText,
    model,
    setModel,
    billing,
    loadBilling,
    tokenCost,
    canAfford,
    ratio,
    setRatio,
    busy,
    pending,
    fresh,
    result,
    setResult,
    gens,
    openId,
    setOpenId,
    process,
    deleteGen,
    setSourceDeleted,
    setVisibility,
    reuse,
    applyPreset,
    savePreset,
    savePresetFromGeneration,
    deletePreset,
    setPresetPublic,
    canProcess: !!image && selected.size > 0 && canAfford,
    pasteFromClipboard,
    useStoredFile,
  };
}

export type StudioState = ReturnType<typeof useStudio>;
