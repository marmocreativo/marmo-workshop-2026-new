import { adminAuthed, handle } from "@/lib/api";
import { query, run } from "@/lib/db";
import { releaseFile, sha256 } from "@/lib/files";
import { readStored } from "@/lib/storage";

type G = { id: string; user_id: string; source_file: string | null; result_file: string | null; source_deleted_at: number | null; source_public: number };

// Mantenimiento: unifica las imágenes idénticas ya guardadas (misma imagen enviada varias veces) y libera el espacio duplicado.
export const POST = handle(async () => {
  await adminAuthed();
  const gens = await query<G>("SELECT id,user_id,source_file,result_file,source_deleted_at,source_public FROM generations ORDER BY created_at");
  const canon = new Map<string, string>(); // user|hash -> archivo canónico
  const remap = new Map<string, string>(); // archivo duplicado -> canónico
  const hashOf = new Map<string, string>(); // archivo -> hash (cada archivo se lee una vez)
  let removed = 0;
  let freed = 0;

  for (const g of gens) {
    for (const f of [g.source_file, g.result_file]) {
      if (!f || hashOf.has(f)) continue;
      let buf: Buffer;
      try {
        buf = await readStored(f);
      } catch {
        continue;
      }
      const h = sha256(buf);
      hashOf.set(f, h);
      const key = `${g.user_id}|${h}`;
      const c = canon.get(key);
      if (!c) {
        canon.set(key, f);
        await run("INSERT OR REPLACE INTO file_hashes(user_id,hash,file) VALUES(?,?,?)", [g.user_id, h, f]);
      } else if (c !== f) {
        remap.set(f, c);
        freed += buf.length;
      }
    }
  }

  for (const [dup, keep] of remap) {
    await run("UPDATE generations SET source_file=? WHERE source_file=?", [keep, dup]);
    await run("UPDATE generations SET result_file=? WHERE result_file=?", [keep, dup]);
    await releaseFile(dup);
    removed++;
  }

  // Las generaciones que ahora comparten referencia quedan con el mismo estado: visible si alguna lo estaba, y pública si alguna lo era.
  for (const keep of new Set(remap.values())) {
    await run(
      `UPDATE generations SET source_deleted_at=NULL WHERE source_file=? AND EXISTS (SELECT 1 FROM generations WHERE source_file=? AND source_deleted_at IS NULL)`,
      [keep, keep],
    );
    await run(
      `UPDATE generations SET source_public=1 WHERE source_file=? AND source_deleted_at IS NULL AND EXISTS (SELECT 1 FROM generations WHERE source_file=? AND source_public=1)`,
      [keep, keep],
    );
  }
  return Response.json({ removed, freedMb: Math.round((freed / 1024 / 1024) * 10) / 10 });
});
