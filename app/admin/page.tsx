import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth.mjs";
import { isAuthed } from "@/lib/guard";
import AdminConsole from "@/components/AdminConsole";

export const dynamic = "force-dynamic";

export const metadata = { title: "Syncwave · Settings" };

export default async function AdminPage() {
  if (!isSetupComplete()) redirect("/setup");
  if (!(await isAuthed())) redirect("/admin/login");
  return <AdminConsole />;
}
