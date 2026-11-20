import { one } from "@/lib/db";
import { readStored } from "@/lib/storage";

// Portada de un preset público, visible sin sesión (la usa el hero de la página de inicio).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await one<{ ref_file: string | null }>("SELECT ref_file FROM presets WHERE id=? AND is_public=1", [id]);
  if (!p?.ref_file) return new Response("No encontrado", { status: 404 });
  try {
    const buf = await readStored(p.ref_file);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": p.ref_file.endsWith(".png") ? "image/png" : "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
