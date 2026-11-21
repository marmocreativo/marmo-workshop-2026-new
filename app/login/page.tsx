import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getUser } from "@/lib/auth";
import { GOOGLE_ERRORS, googleEnabled } from "@/lib/google";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/studio");
  const { error } = await searchParams;
  return <AuthForm mode="login" google={googleEnabled()} error={error ? GOOGLE_ERRORS[error] : undefined} />;
}
