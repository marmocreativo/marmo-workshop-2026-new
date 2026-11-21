"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, jsonBody } from "@/lib/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function AuthForm({ mode, google = false, error }: { mode: "login" | "register"; google?: boolean; error?: string }) {
  const router = useRouter();

  // Errores que vienen de vuelta de Google (?error=...).
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: jsonBody({ email: f.get("email"), password: f.get("password") }),
      });
      router.replace("/studio");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <Link href="/" aria-label="Marmo Workshop" className="inline-block">
          <Logo priority className="h-16" />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {isLogin ? "Bienvenida de vuelta" : "Crea tu cuenta"}
        </h1>
      </div>
      {google && (
        <>
          {/* Enlace normal (no fetch): el navegador sigue las redirecciones hacia Google y de vuelta. */}
          <a
            href="/api/auth/google"
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border bg-white text-base font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
          >
            <GoogleIcon /> {isLogin ? "Continuar con Google" : "Registrarme con Google"}
          </a>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o con tu correo <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? 1 : 8}
            required
            className="h-11 text-base"
          />
          {!isLogin && <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>}
        </div>
        <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {isLogin ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
        <Link href={isLogin ? "/registro" : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
          {isLogin ? "Regístrate" : "Inicia sesión"}
        </Link>
      </p>
    </div>
  );
}
