import { z } from "zod";
import { HttpError, authed, handle } from "@/lib/api";
import { batch, one, run } from "@/lib/db";
import { deleteStored } from "@/lib/storage";

const patchSchema = z.object({
  sourceDeleted: z.boolean().optional(), // borrado suave de la referencia (se puede restaurar)
  isPublic: z.boolean().optional(), // resultado visible para la comunidad
  sourcePublic: z.boolean().optional(), // imagen de referencia visible para la comunidad
});

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new HttpError(400, "Datos inválidos");
  const { sourceDeleted, isPublic, sourcePublic } = body.data;
  const sets: string[] = [];
  const args: (number | null)[] = [];
  if (sourceDeleted !== undefined) {
    sets.push("source_deleted_at=?");
    args.push(sourceDeleted ? Date.now() : null);
    if (sourceDeleted) sets.push("source_public=0"); // lo eliminado deja de ser público
  }
  if (isPublic !== undefined) (sets.push("is_public=?"), args.push(isPublic ? 1 : 0));
  if (sourcePublic !== undefined) (sets.push("source_public=?"), args.push(sourcePublic ? 1 : 0));
  if (!sets.length) throw new HttpError(400, "Nada que actualizar");
  const res = await run(`UPDATE generations SET ${sets.join(",")} WHERE id=? AND user_id=?`, [...args, id, user.id]);
  if (!res.rowsAffected) throw new HttpError(404, "Resultado no encontrado");
  return Response.json({ ok: true });
});

// Elimina el resultado, su imagen de referencia guardada y su relación con los modificadores.
// El contador de usos de los modificadores no se reduce: el uso ya ocurrió.
export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await authed();
  const { id } = await params;
  const g = await one<{ source_file: string | null; result_file: string | null }>(
    "SELECT source_file,result_file FROM generations WHERE id=? AND user_id=?",
    [id, user.id],
  );
  if (!g) throw new HttpError(404, "Resultado no encontrado");
  await batch([
    { sql: "DELETE FROM generation_modifiers WHERE generation_id=?", args: [id] },
    { sql: "DELETE FROM generations WHERE id=?", args: [id] },
  ]);
  await Promise.all([g.source_file, g.result_file].filter((f): f is string => !!f).map(deleteStored));
  return Response.json({ ok: true });
});
