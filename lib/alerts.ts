"use client";

import Swal from "sweetalert2";

// Todas las alertas, avisos y confirmaciones de la app pasan por aquí (SweetAlert2), con el tema oscuro rojo.
const theme = {
  background: "var(--card)",
  color: "var(--foreground)",
  confirmButtonColor: "var(--primary)",
  cancelButtonColor: "var(--muted)",
  customClass: { popup: "mw-swal", cancelButton: "mw-swal-cancel" },
} as const;

const Toast = Swal.mixin({
  ...theme,
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 3200,
  timerProgressBar: true,
  didOpen: (el) => {
    el.onmouseenter = Swal.stopTimer;
    el.onmouseleave = Swal.resumeTimer;
  },
});

// Misma forma que antes (toast.success / error / message) para no tocar cada llamada.
export const toast = {
  success: (title: string) => void Toast.fire({ icon: "success", title }),
  error: (title: string) => void Toast.fire({ icon: "error", title, timer: 5500 }),
  message: (title: string) => void Toast.fire({ icon: "info", title }),
};

type ConfirmOptions = { title?: string; confirmText?: string; danger?: boolean };

/** Pide confirmación antes de una acción. Devuelve true si el usuario acepta. */
export async function confirmAction(text: string, { title = "¿Continuar?", confirmText = "Continuar", danger }: ConfirmOptions = {}) {
  const r = await Swal.fire({
    ...theme,
    icon: danger ? "warning" : "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
    focusCancel: !!danger,
    reverseButtons: true,
    confirmButtonColor: danger ? "var(--destructive)" : "var(--primary)",
  });
  return r.isConfirmed;
}

/** Aviso con un solo botón (errores que requieren atención). */
export function alertBox(title: string, text?: string, icon: "info" | "error" | "success" | "warning" = "info") {
  return Swal.fire({ ...theme, icon, title, text, confirmButtonText: "Entendido" });
}

/** Aviso de tokens agotados: devuelve "plan", "tokens" o null si lo cierra. */
export async function noTokensPopup(): Promise<"plan" | "tokens" | null> {
  const r = await Swal.fire({
    ...theme,
    icon: "warning",
    title: "Te quedaste sin tokens",
    text: "Para seguir creando puedes subir de plan o comprar tokens extra (no caducan).",
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: "Mejorar mi plan",
    denyButtonText: "Comprar tokens extra",
    cancelButtonText: "Ahora no",
    denyButtonColor: "var(--secondary)",
    reverseButtons: false,
  });
  return r.isConfirmed ? "plan" : r.isDenied ? "tokens" : null;
}

/** Ofrece instalar la app. En iPhone/iPad (sin botón de instalar) muestra los pasos. Devuelve true si pide instalar. */
export async function installPopup(ios: boolean) {
  if (ios) {
    await Swal.fire({
      ...theme,
      icon: "info",
      title: "Instala Marmo Workshop",
      html: "En Safari toca el botón <b>Compartir</b> (el cuadro con la flecha) y elige <b>«Añadir a pantalla de inicio»</b>.",
      confirmButtonText: "Entendido",
    });
    return false;
  }
  const r = await Swal.fire({
    ...theme,
    icon: "question",
    title: "Instala Marmo Workshop",
    text: "Ábrela como una app: acceso directo en tu pantalla, ventana propia y carga más rápida.",
    showCancelButton: true,
    confirmButtonText: "Instalar",
    cancelButtonText: "Ahora no",
    reverseButtons: true,
  });
  return r.isConfirmed;
}

/** Avisa de una versión nueva. Devuelve true si el usuario quiere actualizar ya. */
export async function updatePopup(version: string | null) {
  const r = await Swal.fire({
    ...theme,
    icon: "info",
    title: "Hay una nueva versión",
    text: version ? `Marmo Workshop ${version} está lista. Actualiza para tener las últimas mejoras.` : "Actualiza para tener las últimas mejoras.",
    showCancelButton: true,
    confirmButtonText: "Actualizar ahora",
    cancelButtonText: "Después",
    reverseButtons: true,
  });
  return r.isConfirmed;
}
