import { authed, handle } from "@/lib/api";
import { query } from "@/lib/db";
import { parseRoleMap } from "@/lib/material-roles";
import { presetMode } from "@/lib/modes";
import { PRESET_FILE_TYPE, PRESET_FILE_VERSION, type PresetFile } from "@/lib/preset-file";
import { readStored } from "@/lib/storage";

const mime = (f: string) => (f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg");

async function toDataUrl(file: string | null): Promise<string | null> {
  if (!file) return null;
  try {
    return `data:${mime(file)};base64,${(await readStored(file)).toString("base64")}`;
  } catch {
    return null; // archivo perdido: el preset se exporta sin esa imagen
  }
}

// Descarga los presets propios en un archivo JSON (todos, o los de ?ids=a,b,c / ?mode=ocio).
export const GET = handle(async (req: Request) => {
  const user = await authed();
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const mode = url.searchParams.get("mode");
  const rows = await query<{
    id: string;
    name: string;
    mode: string | null;
    free_text: string | null;
    instructions: string | null;
    favorite: number;
    ref_file: string | null;
    materials: string | null;
    material_roles: string | null;
    modifier_ids: string;
  }>(
    `SELECT id,name,mode,free_text,instructions,favorite,ref_file,materials,material_roles,modifier_ids FROM presets
     WHERE user_id=? ${ids.length ? `AND id IN (${ids.map(() => "?").join(",")})` : ""} ${mode ? "AND mode=?" : ""}
     ORDER BY favorite DESC, created_at DESC`,
    [user.id, ...ids, ...(mode ? [mode] : [])],
  );

  const allMods = [...new Set(rows.flatMap((r) => JSON.parse(r.modifier_ids) as string[]))];
  const mods = allMods.length
    ? await query<{ id: string; text: string; slug: string; name: string }>(
        `SELECT m.id,m.text,c.slug,c.name FROM modifiers m JOIN categories c ON c.id=m.category_id
         WHERE m.user_id=? AND m.id IN (${allMods.map(() => "?").join(",")})`,
        [user.id, ...allMods],
      )
    : [];

  const file: PresetFile = { type: PRESET_FILE_TYPE, version: PRESET_FILE_VERSION, presets: [] };
  for (const r of rows) {
    const roles = parseRoleMap(r.material_roles);
    const materials: PresetFile["presets"][number]["materials"] = [];
    for (const f of r.materials ? (JSON.parse(r.materials) as string[]) : []) {
      const image = await toDataUrl(f);
      if (image) materials.push({ image, roles: roles[f] ?? [] });
    }
    file.presets.push({
      name: r.name,
      mode: presetMode(r.mode),
      free_text: r.free_text,
      instructions: r.instructions,
      favorite: !!r.favorite,
      modifiers: (JSON.parse(r.modifier_ids) as string[])
        .map((id) => mods.find((m) => m.id === id))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => ({ category: m.slug, category_name: m.name, text: m.text })),
      cover: await toDataUrl(r.ref_file),
      materials,
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(file), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="marmo-presets-${stamp}.json"`,
    },
  });
});
