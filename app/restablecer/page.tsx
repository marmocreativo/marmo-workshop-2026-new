import Link from "next/link";
import { RecoveryForm } from "@/components/recovery-form";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token)
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">Este enlace no es válido.</p>
        <Link href="/recuperar" className="font-medium text-primary underline-offset-4 hover:underline">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  return <RecoveryForm mode="reset" token={token} />;
}
