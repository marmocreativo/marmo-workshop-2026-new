"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, jsonBody } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
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
