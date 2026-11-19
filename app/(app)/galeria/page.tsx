import { Gallery } from "@/components/app/gallery";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const { modifier } = await searchParams;
  return <Gallery initialModifierId={modifier} />;
}
