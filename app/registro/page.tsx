import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getUser } from "@/lib/auth";

export default async function RegisterPage() {
  if (await getUser()) redirect("/studio");
  return <AuthForm mode="register" />;
}
