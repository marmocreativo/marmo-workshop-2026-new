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
