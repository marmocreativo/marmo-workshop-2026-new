import { redirect } from "next/navigation";
import { RecoveryForm } from "@/components/recovery-form";
import { getUser } from "@/lib/auth";
import { mailEnabled } from "@/lib/mail";

export default async function ForgotPage() {
  if (await getUser()) redirect("/studio");
  return <RecoveryForm mode="forgot" mailReady={mailEnabled()} />;
}
