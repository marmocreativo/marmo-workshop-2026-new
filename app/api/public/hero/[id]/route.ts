import { one } from "@/lib/db";
import { readStored } from "@/lib/storage";

// Imagen del slider del Home, pública. El id cambia con cada imagen, por eso el caché es permanente.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await one<{ file: string }>("SELECT file FROM hero_images WHERE id=?", [id]);
  if (!h) return new Response("No encontrado", { status: 404 });
  try {
    const buf = await readStored(h.file);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": h.file.endsWith(".png") ? "image/png" : h.file.endsWith(".webp") ? "image/webp" : "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
