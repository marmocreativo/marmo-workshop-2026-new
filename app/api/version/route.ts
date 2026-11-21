// Versión y despliegue del servidor. El cliente lo compara con los que trae su bundle para saber si hay una actualización.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION, build: process.env.NEXT_PUBLIC_BUILD_ID },
    { headers: { "Cache-Control": "no-store" } },
  );
}
