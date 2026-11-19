import { getUser, type User } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function authed(): Promise<User> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Inicia sesión para continuar");
  return user;
}

export async function adminAuthed(): Promise<User> {
  const user = await authed();
  if (user.role !== "admin") throw new HttpError(403, "Solo para administradores");
  return user;
}

// Envuelve un handler para convertir HttpError / errores inesperados en JSON.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: e instanceof Error ? e.message : "Error inesperado" }, { status: 500 });
    }
  };
}
