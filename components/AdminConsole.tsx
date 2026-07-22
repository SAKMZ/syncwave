"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, ArrowLeft, LogOut, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import CookiesPanel from "@/components/CookiesPanel";
import AiDjSettings from "@/components/AiDjSettings";

export default function AdminConsole() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
          <LogOut className="size-3.5" /> Sign out
        </Button>
      </div>

      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-eyebrow text-accent-2 uppercase">
        <Settings className="size-3.5" /> Setup
      </div>
      <h1 className="mb-8 font-display text-4xl font-bold">
        <span className="sw-gradient-text">Syncwave</span>
        <span className="text-ink"> settings</span>
      </h1>

      <section className="sw-glass mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Cookie className="size-4 text-accent-2" />
          <h2 className="text-lg font-semibold text-ink">YouTube access</h2>
        </div>
        <CookiesPanel />
      </section>

      <AiDjSettings />
    </main>
  );
}
