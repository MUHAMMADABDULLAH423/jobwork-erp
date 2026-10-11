"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardHeader, Field, TextInput, ErrorAlert, EmptyState, Badge, Th, Td,
} from "@/components/ui";
import { todayISO, fmtDate, fmtNum } from "@/lib/format";
import type { InwardChallan, OutwardChallan } from "@/lib/types";

interface RegisterRow {
  key: string;
  time: string;
  type: "IN" | "OUT";
  vendor: string;
  challan: string;
  item: string;
  qty: string;
  process: string;
}

export default function RegisterClient() {
  const supabase = createClient();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!date) return;
      setLoading(true);
      setError(null);
      const [inRes, outRes] = await Promise.all([
        supabase
          .from("inward_challans")
          .select("*, vendor:vendors(id, name)")
          .eq("challan_date", date)
          .order("created_at", { ascending: true }),
        supabase
          .from("outward_challans")
          .select("*, vendor:vendors(id, name)")
          .eq("challan_date", date)
          .order("created_at", { ascending: true }),
      ]);
      setLoading(false);
      if (inRes.error) {
        setError(inRes.error.message);
        return;
      }
      if (outRes.error) {
        setError(outRes.error.message);
        return;
      }
      const inRows: RegisterRow[] = ((inRes.data ?? []) as unknown as InwardChallan[]).map((c) => ({
        key: `in-${c.id}`,
        time: c.created_at.slice(11, 16),
        type: "IN",
        vendor: c.vendor?.name ?? "—",
        challan: c.vendor_challan_no,
        item: c.item_name,
        qty: `${fmtNum(c.qty)} ${c.unit}`,
        process: c.process_required,
      }));
      const outRows: RegisterRow[] = ((outRes.data ?? []) as unknown as OutwardChallan[]).map((c) => ({
        key: `out-${c.id}`,
        time: c.created_at.slice(11, 16),
        type: "OUT",
        vendor: c.vendor?.name ?? "—",
        challan: c.challan_no,
        item: c.item_name,
        qty: `${fmtNum(c.qty)} ${c.unit}`,
        process: c.process_done,
      }));
      setRows(
        [...inRows, ...outRows].sort((a, b) => a.time.localeCompare(b.time))
      );
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daily Register</h1>
        <p className="mt-1 text-sm text-slate-500">
          Date-wise combined view of inward and outward entries — your paper register, on screen.
        </p>
      </div>

      <Card>
        <CardHeader
          title={fmtDate(date)}
          action={
            <Field label="">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          }
        />
        <div className="px-5 py-4">
          <ErrorAlert message={error} />
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState message="No entries on this date." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <Th>Time</Th>
                    <Th>Type</Th>
                    <Th>Vendor</Th>
                    <Th>Challan No</Th>
                    <Th>Item</Th>
                    <Th>Qty</Th>
                    <Th>Process</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <Td>{r.time}</Td>
                      <Td>
                        <Badge tone={r.type === "IN" ? "blue" : "green"}>{r.type}</Badge>
                      </Td>
                      <Td className="font-medium">{r.vendor}</Td>
                      <Td>{r.challan}</Td>
                      <Td>{r.item}</Td>
                      <Td>{r.qty}</Td>
                      <Td>{r.process}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
