import Link from "next/link";
import { Coins } from "lucide-react";
import { BottomNav, DesktopRail } from "@/components/app/bottom-nav";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  return (
    <div className="min-h-dvh lg:pl-20">
      <DesktopRail isAdmin={isAdmin} tokens={user.tokens} />
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-3 pb-20 lg:max-w-none lg:px-5 lg:pt-5 lg:pb-5">
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <Link href="/" aria-label="Marmo Workshop" className="block w-fit">
            <Logo className="h-9" />
          </Link>
          <Link href="/cuenta" className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
            <Coins className="size-4 text-primary" /> {new Intl.NumberFormat("es-MX").format(user.tokens)}
          </Link>
        </div>
        {children}
      </main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
