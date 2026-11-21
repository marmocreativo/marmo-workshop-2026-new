import { createHash } from "node:crypto";
import { one, run } from "./db";
import { deleteStored, saveFile, storedExists } from "./storage";

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

// Guarda un archivo del usuario sin duplicarlo: si ya tiene uno con el mismo contenido, devuelve ese.
export async function saveDeduped(userId: string, buf: Buffer, ext: string) {
  const hash = sha256(buf);
  const known = await one<{ file: string }>("SELECT file FROM file_hashes WHERE user_id=? AND hash=?", [userId, hash]);
  if (known && (await storedExists(known.file))) return known.file;
  const file = await saveFile(userId, buf, ext);
  await run("INSERT OR REPLACE INTO file_hashes(user_id,hash,file) VALUES(?,?,?)", [userId, hash, file]);
  return file;
}

// Borra el archivo del disco solo si ya ninguna generación lo usa (varias pueden compartirlo).
export async function releaseFile(name: string) {
  const used = await one("SELECT 1 FROM generations WHERE source_file=? OR result_file=? LIMIT 1", [name, name]);
  if (used) return;
  await run("DELETE FROM file_hashes WHERE file=?", [name]);
  await deleteStored(name);
}
