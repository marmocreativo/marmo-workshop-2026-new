import { getUser } from "@/lib/auth";
import { Studio } from "@/components/app/studio";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ ref?: string; tour?: string }> }) {
  const { ref, tour } = await searchParams;
  const user = await getUser();
  // Tutorial en la primera visita de una cuenta nueva (o a demanda con ?tour=1).
  return <Studio initialRef={ref} onboarding={tour === "1" || (!!user && !user.onboarded)} />;
}
