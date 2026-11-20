import { HttpError, adminAuthed, handle } from "@/lib/api";
import { one, query, run } from "@/lib/db";
import { saveFile } from "@/lib/storage";

export const GET = handle(async () => {
  await adminAuthed();
  return Response.json({ images: await query("SELECT id, sort, active, created_at FROM hero_images ORDER BY sort, created_at") });
});

// multipart: una o varias "image". Se agregan al final del slider.
export const POST = handle(async (req: Request) => {
  const admin = await adminAuthed();
  const files = (await req.formData()).getAll("image").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError(400, "Elige al menos una imagen");
  const last = await one<{ m: number | null }>("SELECT MAX(sort) AS m FROM hero_images");
  let sort = (last?.m ?? -1) + 1;
  for (const f of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) throw new HttpError(400, "Solo JPG, PNG o WebP");
    if (f.size > 8 * 1024 * 1024) throw new HttpError(413, `"${f.name}" pesa más de 8 MB`);
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const file = await saveFile(admin.id, Buffer.from(await f.arrayBuffer()), ext);
    await run("INSERT INTO hero_images(id,file,sort,active,created_at) VALUES(?,?,?,1,?)", [crypto.randomUUID(), file, sort++, Date.now()]);
  }
  return Response.json({ ok: true });
});
