"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/vendors", label: "Vendors" },
  { href: "/inward", label: "Inward" },
  { href: "/outward", label: "Outward" },
  { href: "/register", label: "Register" },
  { href: "/billing", label: "Billing" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-slate-200 bg-slate-900 text-slate-200 md:flex">
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-white">JobWork ERP</div>
          <div className="mt-0.5 text-xs text-slate-400">Factory job-work management</div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <button
            onClick={logout}
            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="no-print fixed inset-x-0 top-0 z-10 border-b border-slate-200 bg-slate-900 px-4 py-3 md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-base font-bold text-white">JobWork ERP</span>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200"
          >
            Logout
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-brand-600 text-white" : "text-slate-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 md:ml-60">
        <div className="mx-auto max-w-6xl px-4 py-6 pt-24 md:px-8 md:pt-6">{children}</div>
      </main>
    </div>
  );
}
