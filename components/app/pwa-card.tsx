"use client";

import { useEffect } from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { installPopup, toast, updatePopup } from "@/lib/alerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_VERSION, applyUpdate, checkForUpdate, promptInstall, startPwa, usePwa } from "@/lib/pwa";

// Estado de la app en este dispositivo: instalada o no, versión y actualización.
export function PwaCard() {
  const pwa = usePwa();
  useEffect(() => startPwa(), []);

  async function install() {
    if (pwa.canInstall) {
      if ((await promptInstall()) === "accepted") toast.success("¡App instalada!");
    } else if (pwa.ios) await installPopup(true);
    else toast.message("Abre esta página en Chrome, Edge o Safari para instalarla.");
  }

  async function checkUpdate() {
    const newer = await checkForUpdate();
    if (newer) {
      if (await updatePopup(pwa.latestVersion)) await applyUpdate();
    } else toast.success("Tienes la última versión");
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">App</h2>
      <div className="divide-y rounded-3xl bg-card text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="size-5 text-primary" />
            <div>
              <p className="font-medium">{pwa.installed ? "Instalada en este dispositivo" : "No instalada"}</p>
              <p className="text-xs text-muted-foreground">
                {pwa.installed ? "Estás usando la app instalada." : "Instálala para abrirla como una app, con acceso directo."}
              </p>
            </div>
          </div>
          {pwa.installed ? (
            <CheckCircle2 className="size-5 text-green-500" />
          ) : (
            <Button size="sm" onClick={install} disabled={!pwa.ready}>
              <Download /> Instalar
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">v{APP_VERSION}</Badge>
            <p className={pwa.updateAvailable ? "font-medium text-primary" : "text-muted-foreground"}>
              {pwa.updateAvailable ? `Hay una nueva versión${pwa.latestVersion ? ` (v${pwa.latestVersion})` : ""}` : "Estás al día"}
            </p>
          </div>
          {pwa.updateAvailable ? (
            <Button size="sm" onClick={applyUpdate}>
              <RefreshCw /> Actualizar
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={checkUpdate} disabled={pwa.checking}>
              {pwa.checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Buscar actualización
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
