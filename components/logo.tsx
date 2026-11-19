import Image from "next/image";
import { cn } from "@/lib/utils";

// Logo de Marmo Workshop (public/logo.svg, 697×392). Se dimensiona con la altura: <Logo className="h-9" />.
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.svg"
      alt="Marmo Workshop"
      width={697}
      height={392}
      unoptimized
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  );
}
