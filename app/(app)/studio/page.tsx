import { getUser } from "@/lib/auth";
import { Studio } from "@/components/app/studio";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ ref?: string; tour?: string; preset?: string }> }) {
  const { ref, tour, preset } = await searchParams;
  const user = await getUser();
  // Tutorial en la primera visita de una cuenta nueva (o a demanda con ?tour=1).
  return <Studio initialRef={ref} initialPreset={preset} onboarding={tour === "1" || (!!user && !user.onboarded)} />;
}
