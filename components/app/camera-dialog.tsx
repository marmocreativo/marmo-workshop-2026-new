"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Toma una foto con la cámara web (escritorio).
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

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("No pude acceder a la cámara. Revisa los permisos del navegador."));
    if (!navigator.mediaDevices) setError("Este navegador no permite usar la cámara aquí.");
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

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
          <video ref={videoRef} autoPlay playsInline muted className="w-full -scale-x-100 rounded-2xl bg-black" />
        )}
        <Button className="h-11" disabled={!!error} onClick={capture}>
          <Camera /> Capturar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
