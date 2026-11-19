"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

export function AccountActions() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="h-11 w-full"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut /> Cerrar sesión
    </Button>
  );
}
