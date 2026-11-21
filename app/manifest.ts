import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/studio",
    name: "Marmo Workshop",
    short_name: "Marmo",
    description: "Crea y edita fotografías con IA usando modificadores de estilo, luz, pose y más.",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0f0f",
    theme_color: "#0f0f0f",
    lang: "es-MX",
    categories: ["photo", "productivity"],
    icons: [
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
