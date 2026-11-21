// Inicio de sesión con Google (OAuth 2.0, flujo de código). Se activa al definir GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Detrás del proxy de Dokploy el origen de la petición no es el público: se usa APP_URL.
export const publicUrl = (path = "") => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;

export const googleRedirectUri = () => publicUrl("/api/auth/google/callback");

export const GOOGLE_STATE_COOKIE = "mw_google_oauth";

export const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: "Cancelaste el acceso con Google.",
  google_unverified: "El correo de tu cuenta de Google no está verificado.",
  google: "No pude iniciar sesión con Google. Inténtalo de nuevo.",
};
