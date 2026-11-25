// Roles de los materiales (Estudio Pro): qué categorías se toman de cada imagen extra.

/** Lee un JSON de roles alineado con los materiales: string[][] de slugs, saneado. */
export function parseRoleList(raw: unknown, max = 3): string[][] {
  let v: unknown = [];
  try {
    v = typeof raw === "string" && raw ? JSON.parse(raw) : [];
  } catch {}
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((r) => (Array.isArray(r) ? r.filter((x): x is string => typeof x === "string").slice(0, 10) : []));
}

/** Mapa {archivo: slugs} guardado en el preset. */
export function parseRoleMap(raw: string | null | undefined): Record<string, string[]> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function roleMapOf(files: string[], roles: string[][]): string | null {
  const map: Record<string, string[]> = {};
  files.forEach((f, i) => {
    if (roles[i]?.length) map[f] = roles[i];
  });
  return Object.keys(map).length ? JSON.stringify(map) : null;
}
