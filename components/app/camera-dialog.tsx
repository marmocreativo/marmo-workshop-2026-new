"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Toma una foto con la cámara (frontal o trasera; se puede girar si el dispositivo tiene varias).
export function CameraDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [multi, setMulti] = useState(false); // hay más de una cámara: se muestra el botón para girar

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        // Los nombres de las cámaras solo se conocen después de dar permiso.
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (!cancelled) setMulti(cams.length > 1);
      })
      .catch(() => setError("No pude acceder a la cámara. Revisa los permisos del navegador."));
    if (!navigator.mediaDevices) setError("Este navegador no permite usar la cámara aquí.");
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, facing]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    canvas.toBlob(
      (b) => {
        if (!b) return;
        onCapture(new File([b], "camara.jpg", { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tomar foto</DialogTitle>
          <DialogDescription>Encuadra a la persona y captura.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{error}</p>
        ) : (
          // La frontal se ve en espejo (como en cualquier app de cámara); la foto se guarda sin espejo.
          <video ref={videoRef} autoPlay playsInline muted className={`w-full rounded-2xl bg-black ${facing === "user" ? "-scale-x-100" : ""}`} />
        )}
        <div className="flex gap-2">
          {multi && (
            <Button
              variant="outline"
              className="h-11"
              aria-label="Girar cámara"
              title="Girar cámara"
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            >
              <SwitchCamera /> Girar
            </Button>
          )}
          <Button className="h-11 flex-1" disabled={!!error} onClick={capture}>
            <Camera /> Capturar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
