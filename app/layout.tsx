import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { isFreeUser } from "@/lib/free-tier";

const ADSENSE_CLIENT = "ca-pub-6316196480784999";

// AdSense: visitantes sin sesión y usuarios del tier gratuito. Quien paga (suscripción o compra) no ve anuncios.
async function showAds() {
  if (process.env.NODE_ENV !== "production") return false;
  const user = await getUser();
  return !user || (await isFreeUser(user));
}

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "Marmo Workshop",
  icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" },
  title: "Marmo Workshop — Photo Studio con IA",
  description: "Crea y edita fotografías con IA usando modificadores de estilo, luz, pose y más.",
  appleWebApp: { capable: true, title: "Marmo", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0f0f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ads = await showAds().catch(() => false);
  return (
    <html lang="es" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        {ads && (
           
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} crossOrigin="anonymous" />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
