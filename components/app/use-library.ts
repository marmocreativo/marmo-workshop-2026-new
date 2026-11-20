"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/alerts";
import { api } from "@/lib/client";
import type { Category, Modifier, Preset } from "@/lib/types";

export function useLibrary() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [c, m, p] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<{ modifiers: Modifier[] }>("/api/modifiers"),
      api<{ presets: Preset[] }>("/api/presets"),
    ]);
    setCategories(c.categories);
    setModifiers(m.modifiers);
    setPresets(p.presets);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  return { categories, modifiers, presets, loading, refresh, setModifiers };
}
