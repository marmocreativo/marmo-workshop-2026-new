"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Logo } from "@/components/logo";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, jsonBody } from "@/lib/client";

// "forgot": pide el correo y manda el enlace. "reset": con el token del enlace, crea la contraseña nueva.
export function RecoveryForm({ mode, token, mailReady = true }: { mode: "forgot" | "reset"; token?: string; mailReady?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (mode === "forgot") {
        await api("/api/auth/forgot", { method: "POST", body: jsonBody({ email: f.get("email") }) });
        setSent(true);
      } else {
        await api("/api/auth/reset", { method: "POST", body: jsonBody({ token, password: f.get("password") }) });
        toast.success("Contraseña actualizada");
        router.replace("/studio");
        router.refresh();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <Link href="/" aria-label="Marmo Workshop" className="inline-block">
          <Logo priority className="h-16" />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{mode === "forgot" ? "Recupera tu contraseña" : "Crea una contraseña nueva"}</h1>
        {mode === "forgot" && !sent && <p className="mt-1 text-sm text-muted-foreground">Escribe tu correo y te mandamos un enlace para crear una nueva.</p>}
      </div>

      {sent ? (
        <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
          <MailCheck className="size-8 text-primary" />
          <p>Si ese correo tiene una cuenta, te enviamos un enlace. Revisa tu bandeja (y el spam); dura 1 hora.</p>
        </div>
      ) : mode === "forgot" && !mailReady ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">La recuperación por correo no está disponible por ahora. Escríbenos y te ayudamos.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {mode === "forgot" ? (
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 text-base" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña nueva</Label>
              <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required className="h-11 text-base" />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
          )}
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "forgot" ? "Enviar enlace" : "Guardar contraseña"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
