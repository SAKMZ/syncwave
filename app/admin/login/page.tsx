import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth.mjs";
import { isAuthed } from "@/lib/guard";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Syncwave · Admin login" };

export default async function AdminLoginPage() {
  if (!isSetupComplete()) redirect("/setup");
  if (await isAuthed()) redirect("/admin");
  return <LoginForm />;
}
