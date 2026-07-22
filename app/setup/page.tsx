import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth.mjs";
import SetupWizard from "@/components/SetupWizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Syncwave · Setup" };

export default function SetupPage() {
  // Once claimed, this route is closed — reopening it would be a password reset
  // that requires no password.
  if (isSetupComplete()) redirect("/admin");
  return <SetupWizard />;
}
