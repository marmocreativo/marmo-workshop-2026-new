import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "storage");

// Los archivos se nombran `${userId}_${rand}.${ext}` para validar propiedad al servirlos.
export async function saveFile(userId: string, buf: Buffer, ext: string) {
  await mkdir(DIR, { recursive: true });
  const name = `${userId}_${crypto.randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin"}`;
  await writeFile(path.join(DIR, name), buf);
  return name;
}

export async function deleteStored(name: string) {
  if (name !== path.basename(name)) return;
  await rm(path.join(DIR, name), { force: true });
}

export async function readStored(name: string) {
  if (name !== path.basename(name)) throw new Error("bad name");
  return readFile(path.join(DIR, name));
}
