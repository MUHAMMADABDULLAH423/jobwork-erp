import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, statusTone, Th, Td, EmptyState } from "@/components/ui";
import { todayISO, fmtDate, fmtNum, daysBetween } from "@/lib/format";
import type { InwardChallan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const today = todayISO();

  const [{ count: inwardToday }, { count: outwardToday }, { count: pendingCount }] =
    await Promise.all([
      supabase.from("inward_challans").select("id", { count: "exact", head: true }).eq("challan_date", today),
      supabase.from("outward_challans").select("id", { count: "exact", head: true }).eq("challan_date", today),
      supabase.from("inward_challans").select("id", { count: "exact", head: true }).in("status", ["pending", "partial"]),
    ]);

  const { data: pendingJobs } = await supabase
    .from("inward_challans")
    .select("id, vendor_id, vendor_challan_no, challan_date, item_name, qty, unit, process_required, status, vendor:vendors(id, name)")
    .in("status", ["pending", "partial"])
    .order("challan_date", { ascending: true })
    .limit(50);

  const jobs = (pendingJobs ?? []) as unknown as InwardChallan[];

  const stats = [
    { label: "Inward today", value: inwardToday ?? 0, href: "/inward", tone: "bg-blue-50 text-blue-700" },
    { label: "Outward today", value: outwardToday ?? 0, href: "/outward", tone: "bg-emerald-50 text-emerald-700" },
    { label: "Pending jobs", value: pendingCount ?? 0, href: "/inward", tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{fmtDate(today)} — today&apos;s factory activity</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 transition-shadow hover:shadow-md">
              <div className={`text-3xl font-bold ${s.tone} inline-block rounded-lg px-3 py-1`}>
                {s.value}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-600">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/inward"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + New Inward Challan
        </Link>
        <Link
          href="/outward"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          + New Outward Challan
        </Link>
        <Link
          href="/billing"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Month-End Billing
        </Link>
      </div>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Pending jobs</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Material received but work not fully returned to the vendor.
          </p>
        </div>
        {jobs.length === 0 ? (
          <EmptyState message="No pending jobs. All received material has been returned." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <Th>Vendor</Th>
                  <Th>Vendor Challan</Th>
                  <Th>Date</Th>
                  <Th>Item</Th>
                  <Th>Qty</Th>
                  <Th>Process Required</Th>
                  <Th>Status</Th>
                  <Th>Waiting</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <Td className="font-medium">{j.vendor?.name ?? "—"}</Td>
                    <Td>{j.vendor_challan_no}</Td>
                    <Td>{fmtDate(j.challan_date)}</Td>
                    <Td>{j.item_name}</Td>
                    <Td>
                      {fmtNum(j.qty)} {j.unit}
                    </Td>
                    <Td>{j.process_required}</Td>
                    <Td>
                      <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                    </Td>
                    <Td>{daysBetween(j.challan_date, today)} days</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
