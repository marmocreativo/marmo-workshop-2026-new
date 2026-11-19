import { HttpError, authed, handle } from "@/lib/api";
import { one } from "@/lib/db";
import { readStored } from "@/lib/storage";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
};

// Un archivo lo ve su dueño, o cualquier usuario con sesión si el dueño lo marcó como público.
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ name: string }> }) => {
  const user = await authed();
  const { name } = await params;
  if (!name.startsWith(`${user.id}_`)) {
    const shared = await one(
      `SELECT 1 FROM generations
       WHERE (result_file=? AND is_public=1) OR (source_file=? AND source_public=1 AND source_deleted_at IS NULL)`,
      [name, name],
    );
    if (!shared) throw new HttpError(404, "No encontrado");
  }
  let buf: Buffer;
  try {
    buf = await readStored(name);
  } catch {
    throw new HttpError(404, "No encontrado");
  }
  const owned = name.startsWith(`${user.id}_`);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Cache-Control": `${owned ? "private" : "private, no-store"}, max-age=${owned ? 31536000 : 0}${owned ? ", immutable" : ""}`,
    },
  });
});
