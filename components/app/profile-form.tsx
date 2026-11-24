"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/alerts";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, jsonBody } from "@/lib/client";

export type Profile = { email: string; name: string; phone: string; google: boolean; created_at: number | null };

// Edición de datos personales, correo y contraseña (los dos últimos piden la contraseña actual).
export function ProfileForm({ profile, admin, onSaved }: { profile: Profile; admin: boolean; onSaved: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [pass1, setPass1] = useState("");
  const [newPass, setNewPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const saveData = () =>
    run("data", async () => {
      await api("/api/profile", { method: "PATCH", body: jsonBody({ name, phone }) });
      toast.success("Datos actualizados");
      onSaved();
    });

  const saveEmail = () =>
    run("email", async () => {
      await api("/api/profile/credentials", { method: "POST", body: jsonBody({ currentPassword: pass1, email }) });
      toast.success("Correo actualizado");
      setPass1("");
      onSaved();
      router.refresh();
    });

  const savePassword = () =>
    run("pass", async () => {
      await api("/api/profile/credentials", { method: "POST", body: jsonBody({ currentPassword: pass2, newPassword: newPass }) });
      toast.success("Contraseña actualizada");
      setPass2("");
      setNewPass("");
    });

  const card = "space-y-3 rounded-3xl border bg-card p-5";
  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="text-lg font-semibold">Datos personales</h2>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-phone">Teléfono</Label>
          <Input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" className="h-11 text-base" />
        </div>
        <Button className="h-11 w-full" disabled={busy === "data"} onClick={saveData}>
          {busy === "data" && <Loader2 className="animate-spin" />} Guardar datos
        </Button>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Correo electrónico</h2>
        {admin ? (
          <p className="text-sm text-muted-foreground">El correo del administrador se define en la configuración del servidor.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Correo</Label>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pass1">Contraseña actual</Label>
              <PasswordInput id="p-pass1" value={pass1} onChange={(e) => setPass1(e.target.value)} autoComplete="current-password" />
            </div>
            <Button variant="outline" className="h-11 w-full" disabled={busy === "email" || !pass1 || email === profile.email} onClick={saveEmail}>
              {busy === "email" && <Loader2 className="animate-spin" />} Cambiar correo
            </Button>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Contraseña</h2>
        {profile.google && (
          <p className="text-sm text-muted-foreground">
            Entraste con Google. Si no tienes una contraseña propia, créala desde “¿Olvidaste tu contraseña?” en la pantalla de inicio de sesión.
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="p-pass2">Contraseña actual</Label>
          <PasswordInput id="p-pass2" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-new">Contraseña nueva</Label>
          <PasswordInput id="p-new" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" minLength={8} />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>
        <Button variant="outline" className="h-11 w-full" disabled={busy === "pass" || !pass2 || newPass.length < 8} onClick={savePassword}>
          {busy === "pass" && <Loader2 className="animate-spin" />} Cambiar contraseña
        </Button>
      </section>
    </div>
  );
}
