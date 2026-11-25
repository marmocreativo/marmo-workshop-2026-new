"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { instructionsPopup, noTokensPopup, toast } from "@/lib/alerts";
import { api, fileUrl, jsonBody, resizeImage } from "@/lib/client";
import { useRouter } from "next/navigation";
import { MODELS, getModel, resolveRatio } from "@/lib/models";
import { DEFAULT_MODE, allowsCategory, getMode, isMode, type StudioMode } from "@/lib/modes";
import { FREE_FIRST_MAX_TOKENS, tokensFor } from "@/lib/tokens";
import type { CommunityPreset, Generation, Modifier, Preset } from "@/lib/types";
import type { BillingMe } from "./billing-panel";
import { emitBalance, requestBalanceRefresh } from "@/lib/balance";
import { useLibrary } from "./use-library";

export type ReusePart = "reference" | "result" | "modifiers" | "text" | "model";

type GenerateResult = { id: string; resultFile: string; kind: "image" | "video" };

// Estado y acciones del Studio, compartidos entre la vista móvil y la de escritorio.
export type TourStep = "intro" | "photo" | "preset" | "process" | "wait" | "result" | "edit" | "final";

export function useStudio(initialRef?: string, onboarding = false, initialPreset?: string) {
  const library = useLibrary();
  // Modo del Studio (Ocio, Filtro, Producto, Estudio Pro). El tutorial corre en Filtro; si no, se recuerda el último.
  // El tutorial corre en Filtro (el cambio más fácil de entender: tu misma foto, mejorada).
  const [mode, setModeRaw] = useState<StudioMode>(onboarding ? "filtro" : DEFAULT_MODE);
  useEffect(() => {
    if (onboarding) return;
    try {
      const saved = localStorage.getItem("mw:mode");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isMode(saved)) setModeRaw(saved);
    } catch {}
  }, [onboarding]);
  const modeDef = getMode(mode);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState("");
  // Preset aplicado ahora (se marca en su tarjeta y se liga a las generaciones para mostrar sus resultados).
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  // Materiales: imágenes extra (logos, ropa, fondos...) que se mandan junto a la foto de referencia.
  const [materials, setMaterials] = useState<File[]>([]);
  // Estudio Pro: categorías (slugs) que se toman de cada material; [] = material libre. Va alineado con `materials`.
  const [materialRoles, setRoles] = useState<string[][]>([]);
  const [model, setModel] = useState(MODELS[0].id);
  const [ratioChoice, setRatio] = useState("auto");
  // Si el modelo elegido no soporta la proporción, se usa "auto".
  const ratio = modeDef.ratio ? resolveRatio(getModel(model) ?? MODELS[0], ratioChoice) : "auto";
  const router = useRouter();
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const warnedRef = useRef(false);
  const balRef = useRef(0); // saldo más reciente, para descontar varias peticiones seguidas sin esperar el render
  const loadBilling = useCallback(async () => {
    const b = await api<BillingMe>("/api/billing/me");
    balRef.current = b.account.tokens;
    setBilling(b);
    return b;
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
  // Primera generación del tutorial: gratis con modelos estándar (el servidor decide; aquí solo se refleja).
  const freeFirst = !!billing?.account.freeFirst && tokenCost !== null && tokenCost <= FREE_FIRST_MAX_TOKENS;
  const canAfford = !billing || billing.account.bypass || freeFirst || (tokenCost !== null && billing.account.tokens >= tokenCost);
  // Se pueden lanzar varias peticiones a la vez: `pending` cuenta las que siguen en proceso.
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  // Resultados nuevos que el usuario aún no ha abierto (la galería los marca con una pulsación).
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [gens, setGens] = useState<Generation[]>([]);
  const [openId, setOpenIdRaw] = useState<string | null>(null);
  // Tutorial: "guide" (foto → preset → procesar) y luego result → edit → final, que avanzan por acciones del usuario.
  const [tourOn, setTourOn] = useState(onboarding);
  const [tourPhase, setTourPhase] = useState<"intro" | "guide" | "result" | "edit" | "final">("intro");
  const setOpenId = useCallback((id: string | null) => {
    setOpenIdRaw(id);
    if (!id) setTourPhase((p) => (p === "result" ? "edit" : p)); // al cerrar el resultado grande, sigue la explicación de ajustes
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
    async (created?: { id: string }[], opts?: { replace?: boolean }) => {
      await library.refresh();
      if (!created?.length) return;
      // replace: los nuevos sustituyen a los modificadores elegidos; si no, se suman.
      if (opts?.replace) setSelected(new Set(created.map((m) => m.id)));
      else setSelected((s) => new Set([...s, ...created.map((m) => m.id)]));
    },
    [library],
  );

  const maxMaterials = modeDef.materials ? (getModel(model) ?? MODELS[0]).maxMaterials : 0;
  const addMaterials = useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return;
      const room = Math.max(0, maxMaterials - materials.length);
      if (imgs.length > room) toast.message(`Este modelo admite hasta ${maxMaterials} materiales`);
      const small = await Promise.all(imgs.slice(0, room).map((f) => resizeImage(f, 1280).catch(() => f)));
      setMaterials((m) => [...m, ...small].slice(0, maxMaterials));
      setRoles((r) => [...r, ...small.map(() => [] as string[])].slice(0, maxMaterials));
    },
    [maxMaterials, materials.length],
  );
  const removeMaterial = useCallback((i: number) => {
    setMaterials((m) => m.filter((_, k) => k !== i));
    setRoles((r) => r.filter((_, k) => k !== i));
  }, []);
  const setMaterialRoles = useCallback((i: number, slugs: string[]) => setRoles((r) => r.map((x, k) => (k === i ? slugs : x))), []);

  const clearSelected = useCallback(() => {
    setSelected(new Set());
    setAppliedPresetId(null);
  }, []);

  // Lo que muestra la biblioteca en el modo actual: categorías permitidas, sus modificadores y los presets del modo.
  const modeCategories = useMemo(() => library.categories.filter((c) => allowsCategory(modeDef, c.slug)), [library.categories, modeDef]);
  const modeModifiers = useMemo(() => {
    const ok = new Set(modeCategories.map((c) => c.id));
    return library.modifiers.filter((m) => ok.has(m.category_id));
  }, [library.modifiers, modeCategories]);
  const modePresets = useMemo(
    () => library.presets.filter((p) => p.mode === mode).sort((a, b) => b.favorite - a.favorite || b.created_at - a.created_at),
    [library.presets, mode],
  );

  // Resultados de cada preset: generaciones ligadas a él o, para las anteriores, con sus mismos modificadores y texto.
  const presetResults = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const p of library.presets) {
      const key = [...p.modifier_ids].sort().join(",");
      out[p.id] = gens
        .filter(
          (g) =>
            g.result_file &&
            g.kind === "image" &&
            (g.preset_id === p.id ||
              (!g.preset_id && key && g.modifiers.map((m) => m.modifier_id).sort().join(",") === key && (g.free_text ?? "") === (p.free_text ?? ""))),
        )
        .slice(0, 8)
        .map((g) => g.result_file!);
    }
    return out;
  }, [library.presets, gens]);

  // Favoritos: aparecen primero en su lista.
  async function toggleModifierFavorite(m: Modifier) {
    const next = m.favorite ? 0 : 1;
    library.setModifiers(library.modifiers.map((x) => (x.id === m.id ? { ...x, favorite: next } : x)));
    try {
      await api(`/api/modifiers/${m.id}`, { method: "PATCH", body: jsonBody({ favorite: !!next }) });
    } catch (e) {
      toast.error((e as Error).message);
      library.refresh().catch(() => {});
    }
  }
  async function togglePresetFavorite(p: Preset) {
    try {
      await api(`/api/presets/${p.id}`, { method: "PATCH", body: jsonBody({ favorite: !p.favorite }) });
      await library.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // Cambiar de modo quita lo que ese modo no admite (modificadores de otras categorías, materiales).
  const setMode = useCallback(
    (m: StudioMode) => {
      setModeRaw(m);
      try {
        localStorage.setItem("mw:mode", m);
      } catch {}
      const def = getMode(m);
      const ok = new Set(library.categories.filter((c) => allowsCategory(def, c.slug)).map((c) => c.id));
      const catOf = new Map(library.modifiers.map((x) => [x.id, x.category_id]));
      setSelected((s) => new Set([...s].filter((id) => ok.has(catOf.get(id) ?? ""))));
      if (!def.materials) {
        setMaterials([]);
        setRoles([]);
      }
    },
    [library.categories, library.modifiers],
  );

  // Basta con un modificador o con texto en el prompt manual.
  const hasInput = selected.size > 0 || freeText.trim().length > 0;
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

  // Llegar desde la Biblioteca con ?preset=id aplica ese preset en cuanto carga la biblioteca (una sola vez).
  const presetDone = useRef(false);
  useEffect(() => {
    if (!initialPreset || presetDone.current || library.loading) return;
    presetDone.current = true;
    const p = library.presets.find((x) => x.id === initialPreset);
    if (p) applyPreset(p);
    else toast.error("No encontré ese preset");
    router.replace("/studio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPreset, library.loading]);

  // Avisa que se acabaron los tokens y lleva a Cuenta (planes o recargas).
  async function outOfTokens() {
    const go = await noTokensPopup();
    if (go) router.push(go === "plan" ? "/cuenta#planes" : "/cuenta#tokens");
  }

  async function process() {
    if (!image) return toast.error("Primero agrega una foto");
    if (!hasInput) return toast.error("Elige un modificador o escribe el prompt manual");
    if (!canAfford) return outOfTokens();
    if (tourOn && tourPhase === "edit") setTourPhase("final"); // en el paso "Ajusta y repite", procesar lo completa
    setPending((n) => n + 1);
    // El servidor cobra al recibir la petición: se refleja de inmediato y luego se reconcilia con el saldo real.
    if (billing && !billing.account.bypass && !freeFirst && tokenCost) emitBalance(Math.max(0, balRef.current - tokenCost));
    try {
      const form = new FormData();
      form.set("image", await resizeImage(image));
      form.set("model", model);
      form.set("aspectRatio", ratio);
      form.set("mode", mode);
      if (appliedPresetId) form.set("presetId", appliedPresetId);
      form.set("freeText", freeText);
      form.set("modifierIds", jsonBody([...selected]));
      for (const m of materials.slice(0, maxMaterials)) form.append("materials", m);
      form.set("materialRoles", jsonBody(materialRoles.slice(0, maxMaterials)));
      const out = await api<GenerateResult>("/api/generate", { method: "POST", body: form });
      setResult(out);
      await Promise.all([loadGens(), library.refresh()]).catch(() => {});
      if (tourOn && tourPhase === "guide") {
        // En el tutorial el primer resultado sí se abre en grande.
        setTourPhase("result");
        setOpenId(out.id);
      } else setFresh((f) => new Set(f).add(out.id)); // sin abrir el modal: la galería pulsa para avisar
    } catch (e) {
      const msg = (e as Error).message;
      if (/Tokens insuficientes/i.test(msg)) outOfTokens();
      else toast.error(msg);
      loadGens().catch(() => {});
    } finally {
      setPending((n) => Math.max(0, n - 1));
      loadBilling()
        .then((b) => {
          // Si tras cobrar ya no alcanza para otra generación, se avisa una sola vez.
          const low = !b.account.bypass && b.account.tokens < (tokenCost ?? 1);
          if (low && !warnedRef.current) outOfTokens();
          warnedRef.current = low;
        })
        .catch(() => {});
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
      all.map((x) => {
        const sameSource = !!g.source_file && x.source_file === g.source_file;
        return x.id === g.id || sameSource
          ? {
              ...x,
              is_public: x.id === g.id && patch.isPublic !== undefined ? +patch.isPublic : x.is_public,
              source_public: patch.sourcePublic === undefined ? x.source_public : +patch.sourcePublic,
            }
          : x;
      }),
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
    const file = gens.find((g) => g.id === id)?.source_file;
    setGens((all) =>
      all.map((g) => (g.id === id || (!!file && g.source_file === file) ? { ...g, source_deleted_at: at, source_public: deleted ? 0 : g.source_public } : g)),
    );
    try {
      await api(`/api/generations/${id}`, { method: "PATCH", body: jsonBody({ sourceDeleted: deleted }) });
      toast.success(deleted ? "Imagen quitada de la biblioteca" : "Imagen restaurada");
    } catch (e) {
      toast.error((e as Error).message);
      loadGens().catch(() => {});
    }
  }

  // Presets: solo modificadores + texto extra (la imagen es una portada y no se carga como foto).
  // Carga los materiales guardados del preset (son editables: se pueden quitar o agregar otros).
  async function loadPresetMaterials(files: string[], roles: Record<string, string[]> = {}) {
    try {
      const loaded = await Promise.all(
        files.map(async (name) => {
          const blob = await (await fetch(fileUrl(name))).blob();
          return new File([blob], name, { type: blob.type || "image/jpeg" });
        }),
      );
      setMaterials(loaded.slice(0, 3));
      setRoles(files.slice(0, 3).map((f) => roles[f] ?? []));
    } catch {
      toast.error("No pude cargar los materiales del preset");
    }
  }

  function applyPreset(p: Preset) {
    setMaterials([]);
    setRoles([]);
    if (p.materials?.length) loadPresetMaterials(p.materials, p.material_roles);
    const alive = new Set(library.modifiers.map((m) => m.id));
    const ids = p.modifier_ids.filter((id) => alive.has(id));
    setSelected(new Set(ids));
    setAppliedPresetId(p.id);
    setFreeText(p.free_text ?? "");
    if (ids.length < p.modifier_ids.length) toast.message("Algunos modificadores del preset ya no existen");
    if (p.instructions) instructionsPopup(p.name, p.instructions);
    else toast.success(`Preset "${p.name}" aplicado`);
  }

  async function savePreset(name: string, withImage: boolean, instructions = "") {
    const form = new FormData();
    form.set("name", name);
    form.set("freeText", freeText);
    form.set("modifierIds", jsonBody([...selected]));
    form.set("instructions", instructions);
    form.set("mode", mode);
    for (const m of materials.slice(0, 3)) form.append("materials", m);
    form.set("materialRoles", jsonBody(materialRoles.slice(0, 3)));
    if (withImage && image) form.set("image", await resizeImage(image, 640));
    await api("/api/presets", { method: "POST", body: form });
    await library.refresh();
    toast.success("Preset guardado");
  }

  // "Copiar desde imagen": analiza una foto con el enfoque del modo actual y crea un preset con sus modificadores.
  async function presetFromImage(file: File) {
    try {
      const small = await resizeImage(file, 1280);
      const form = new FormData();
      form.set("image", small);
      form.set("mode", mode);
      const an = await api<{ suggestions: { categoryId: string; text: string }[]; name: string }>("/api/analyze", { method: "POST", body: form });
      requestBalanceRefresh(); // el análisis cuesta tokens
      if (!an.suggestions.length) return toast.message("No encontré nada que copiar de esa imagen");

      // La foto queda como origen de los modificadores y como portada del preset.
      const of = new FormData();
      of.set("image", small);
      const { originFile } = await api<{ originFile: string }>("/api/modifiers/origin", { method: "POST", body: of });
      const { modifiers: created } = await api<{ modifiers: Modifier[] }>("/api/modifiers", {
        method: "POST",
        body: jsonBody({ items: an.suggestions.map((x) => ({ ...x, originFile })) }),
      });

      const pf = new FormData();
      pf.set("name", an.name || `${modeDef.label} desde imagen`);
      pf.set("modifierIds", jsonBody(created.map((m) => m.id)));
      pf.set("mode", mode);
      pf.set("image", await resizeImage(file, 640));
      const { preset } = await api<{ preset: Preset }>("/api/presets", { method: "POST", body: pf });
      await library.refresh();

      // Se aplica de inmediato.
      setSelected(new Set(created.map((m) => m.id)));
      setAppliedPresetId(preset.id);
      setFreeText("");
      setMaterials([]);
      setRoles([]);
      toast.success(`Preset "${preset.name}" creado y aplicado`);
    } catch (e) {
      toast.error((e as Error).message);
      requestBalanceRefresh();
    }
  }

  async function savePresetFromGeneration(generationId: string, name: string) {
    const form = new FormData();
    form.set("name", name);
    form.set("generationId", generationId);
    form.set("mode", mode);
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

  // Usa un preset público: si ya lo tienes lo aplica; si no, lo copia a tu biblioteca (con sus modificadores) y lo aplica.
  async function applyCommunityPreset(c: CommunityPreset) {
    try {
      const own = library.presets.find((p) => p.name === c.name && (p.free_text ?? "") === (c.free_text ?? ""));
      if (own) return applyPreset(own);
      const { id } = await api<{ id: string }>(`/api/community/presets/${c.id}/clone`, { method: "POST" });
      const [m, p] = await Promise.all([
        api<{ modifiers: Modifier[] }>("/api/modifiers"),
        api<{ presets: Preset[] }>("/api/presets"),
      ]);
      library.setModifiers(m.modifiers);
      library.refresh().catch(() => {});
      const fresh = p.presets.find((x) => x.id === id);
      if (!fresh) return;
      const alive = new Set(m.modifiers.map((x) => x.id));
      setSelected(new Set(fresh.modifier_ids.filter((x) => alive.has(x))));
      setAppliedPresetId(fresh.id);
      setFreeText(fresh.free_text ?? "");
      setMaterials([]);
      setRoles([]);
      if (fresh.materials.length) loadPresetMaterials(fresh.materials, fresh.material_roles);
      if (fresh.instructions) instructionsPopup(fresh.name, fresh.instructions);
      else toast.success(`Preset "${fresh.name}" aplicado`);
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

  const tourStep: TourStep | null = !tourOn
    ? null
    : tourPhase !== "guide"
      ? tourPhase
      : !image
        ? "photo"
        : pending > 0
          ? "wait"
          : !hasInput
            ? "preset"
            : "process";
  const finishTour = () => {
    setTourOn(false);
    api("/api/onboarding", { method: "POST" }).catch(() => {});
  };
  const tour = { step: tourStep, finish: finishTour, next: () => setTourPhase((p) => (p === "edit" ? "final" : p === "intro" ? "guide" : p)) };

  return {
    ...library,
    mode,
    setMode,
    modeDef,
    modeCategories,
    modeModifiers,
    modePresets,
    presetResults,
    appliedPresetId,
    toggleModifierFavorite,
    togglePresetFavorite,
    tour,
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
    materials,
    materialRoles,
    setMaterialRoles,
    maxMaterials,
    addMaterials,
    removeMaterial,
    model,
    setModel,
    billing,
    loadBilling,
    tokenCost,
    freeFirst,
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
    applyCommunityPreset,
    savePreset,
    savePresetFromGeneration,
    presetFromImage,
    deletePreset,
    setPresetPublic,
    hasInput,
    canProcess: !!image && hasInput && canAfford,
    pasteFromClipboard,
    useStoredFile,
  };
}

export type StudioState = ReturnType<typeof useStudio>;
