"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { Category, Modifier } from "@/lib/types";

export function useLibrary() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [c, m] = await Promise.all([
      api<{ categories: Category[] }>("/api/categories"),
      api<{ modifiers: Modifier[] }>("/api/modifiers"),
    ]);
    setCategories(c.categories);
    setModifiers(m.modifiers);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  return { categories, modifiers, loading, refresh, setModifiers };
}
