import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const nextConfig: NextConfig = {
  output: "standalone", // imagen Docker mínima
  // Versión de la app y de este despliegue: el cliente los compara con /api/version para avisar de actualizaciones.
  env: { NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_BUILD_ID: String(Date.now()) },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
