"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Phone, UserRound } from "lucide-react";
import { toast } from "@/lib/alerts";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { AccountActions } from "./account-actions";
import { BillingPanel } from "./billing-panel";
import { ProfileForm, type Profile } from "./profile-form";
import { PwaCard } from "./pwa-card";

type Tab = "profile" | "data" | "subscription" | "history";
const TABS: [Tab, string][] = [
  ["profile", "Perfil"],
  ["data", "Actualizar datos"],
  ["subscription", "Mi suscripción"],
  ["history", "Facturación e historial"],
];

export function AccountTabs({ justPaid, email, admin, initialTab }: { justPaid: boolean; email: string; admin: boolean; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await api<Profile>("/api/profile"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm font-medium">
        {TABS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`h-9 flex-1 whitespace-nowrap rounded-md px-3 ${tab === v ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="flex flex-col gap-4">
          {!profile ? (
            <Skeleton className="h-40 rounded-3xl" />
          ) : (
            <section className="space-y-3 rounded-3xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <UserRound className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{profile.name || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">
                    {admin ? "Administrador" : "Usuario"}
                    {profile.created_at && ` · desde ${new Date(profile.created_at).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}`}
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" /> <span className="truncate">{email}</span>
              </p>
              <p className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" /> {profile.phone || <span className="text-muted-foreground">Sin teléfono</span>}
              </p>
              {(!profile.name || !profile.phone) && (
                <button type="button" onClick={() => setTab("data")} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Completar mis datos
                </button>
              )}
            </section>
          )}
          <PwaCard />
          <AccountActions />
        </div>
      )}

      {tab === "data" && (profile ? <ProfileForm profile={profile} admin={admin} onSaved={load} /> : <Skeleton className="h-72 rounded-3xl" />)}
      {tab === "subscription" && <BillingPanel justPaid={justPaid} view="subscription" />}
      {tab === "history" && <BillingPanel justPaid={false} view="history" />}
    </div>
  );
}
