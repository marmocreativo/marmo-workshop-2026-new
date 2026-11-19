import { HttpError, authed, handle } from "@/lib/api";
import { saveFile } from "@/lib/storage";

// Guarda la imagen analizada para mostrarla como "origen" de los modificadores que se guarden de ella.
// Se sube al guardar (no al analizar) para no dejar archivos huérfanos si el usuario cancela.
export const POST = handle(async (req: Request) => {
  const user = await authed();
  const file = (await req.formData()).get("image");
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new HttpError(400, "Falta la imagen");
  if (file.size > 12 * 1024 * 1024) throw new HttpError(413, "La imagen es muy pesada (máx. 12 MB)");
  const originFile = await saveFile(user.id, Buffer.from(await file.arrayBuffer()), file.type === "image/png" ? "png" : "jpg");
  return Response.json({ originFile });
});
