import { Studio } from "@/components/app/studio";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return <Studio initialRef={ref} />;
}
