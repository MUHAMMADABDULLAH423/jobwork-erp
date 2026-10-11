"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardHeader, Field, SelectInput, TextInput, PrimaryButton, SecondaryButton,
  ErrorAlert, EmptyState, Badge, statusTone, Th, Td,
} from "@/components/ui";
import BillDoc from "@/components/BillDoc";
import { currentMonth, monthRange, fmtDate, fmtMonth, fmtNum, fmtMoney } from "@/lib/format";
import type { Vendor, OutwardChallan, MonthBill, BillLine } from "@/lib/types";

export default function BillingClient({
  vendors,
}: {
  vendors: Pick<Vendor, "id" | "name" | "phone" | "address">[];
}) {
  const supabase = createClient();
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [month, setMonth] = useState(currentMonth());
  const [liveLines, setLiveLines] = useState<BillLine[]>([]);
  const [savedBill, setSavedBill] = useState<MonthBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const vendor = vendors.find((v) => v.id === vendorId) ?? null;
  const isFinal = savedBill?.status === "final";

  // Draft views recompute live from outward_challans (late entries get picked up).
  // Final bills keep their frozen snapshot.
  const lines = isFinal && savedBill ? savedBill.lines : liveLines;
  const totalQty = lines.reduce((s, l) => s + Number(l.qty), 0);
  const totalAmount = lines.reduce((s, l) => s + Number(l.amount), 0);

  useEffect(() => {
    async function load() {
      if (!vendorId || !month) return;
      setLoading(true);
      setError(null);
      const { start, end } = monthRange(month);
      const [{ data: outs, error: outErr }, { data: bill, error: billErr }] = await Promise.all([
        supabase
          .from("outward_challans")
          .select("*")
          .eq("vendor_id", vendorId)
          .gte("challan_date", start)
          .lte("challan_date", end)
          .order("challan_date", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("month_bills")
          .select("*")
          .eq("vendor_id", vendorId)
          .eq("month", month)
          .maybeSingle(),
      ]);
      setLoading(false);
      if (outErr) {
        setError(outErr.message);
        return;
      }
      if (billErr) {
        setError(billErr.message);
        return;
      }
      setLiveLines(
        ((outs ?? []) as OutwardChallan[]).map((c) => ({
          date: c.challan_date,
          challan_no: c.challan_no,
          vendor_challan_ref: c.vendor_challan_ref,
          item_name: c.item_name,
          process_done: c.process_done,
          qty: Number(c.qty),
          unit: c.unit,
          rate: Number(c.rate),
          amount: Number(c.amount),
        }))
      );
      setSavedBill(bill ? ({ ...bill, lines: (bill.lines ?? []) as BillLine[] } as MonthBill) : null);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, month]);

  async function saveBill(status: "draft" | "final") {
    if (!vendorId || !month) return;
    setError(null);
    if (liveLines.length === 0) {
      setError("No outward entries for this vendor and month — nothing to bill.");
      return;
    }
    if (status === "final" && !confirm(`Mark the ${fmtMonth(month)} bill for ${vendor?.name} as FINAL? Final bills are frozen and keep their snapshot.`)) {
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("month_bills")
      .upsert(
        {
          vendor_id: vendorId,
          month,
          total_qty: totalQty,
          total_amount: totalAmount,
          status,
          lines: liveLines,
        },
        { onConflict: "vendor_id,month" }
      )
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSavedBill({ ...(data as MonthBill), lines: liveLines });
  }

  function doPrint() {
    setPrinting(true);
  }

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => window.print(), 80);
    const clear = () => setPrinting(false);
    window.addEventListener("afterprint", clear);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", clear);
    };
  }, [printing]);

  return (
    <div>
      <div className={printing ? "no-print" : ""}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Month-End Billing</h1>
            <p className="mt-1 text-sm text-slate-500">
              Pick a vendor and month — the statement builds itself from your outward challans. No manual month-end compilation.
            </p>
          </div>

          <Card>
            <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
              <Field label="Vendor">
                <SelectInput value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Month">
                <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </Field>
              <div className="flex items-end">
                {savedBill && (
                  <Badge tone={statusTone(savedBill.status)}>
                    {savedBill.status === "final" ? "FINAL — frozen snapshot" : "Draft saved"}
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          <ErrorAlert message={error} />

          <Card>
            <CardHeader
              title={vendor ? `Statement — ${vendor.name} · ${fmtMonth(month)}` : "Statement"}
              subtitle={
                isFinal
                  ? "Final bill — showing the frozen snapshot. Outward entries are locked out of this view."
                  : "Draft — lines are recomputed live from outward challans, so late entries are picked up automatically."
              }
              action={
                <div className="flex gap-2">
                  {!isFinal && (
                    <>
                      <SecondaryButton onClick={() => saveBill("draft")} disabled={saving || liveLines.length === 0}>
                        {saving ? "Saving…" : "Save as Draft"}
                      </SecondaryButton>
                      <PrimaryButton onClick={() => saveBill("final")} disabled={saving || liveLines.length === 0}>
                        Mark Final
                      </PrimaryButton>
                    </>
                  )}
                  <SecondaryButton onClick={doPrint} disabled={lines.length === 0}>
                    Print Bill
                  </SecondaryButton>
                </div>
              }
            />
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : lines.length === 0 ? (
              <EmptyState message="No outward challans for this vendor and month." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <Th>Date</Th>
                      <Th>Outward Challan</Th>
                      <Th>Vendor Ref</Th>
                      <Th>Item</Th>
                      <Th>Process</Th>
                      <Th>Qty</Th>
                      <Th>Rate</Th>
                      <Th>Amount</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <Td>{fmtDate(l.date)}</Td>
                        <Td className="font-semibold">{l.challan_no}</Td>
                        <Td>{l.vendor_challan_ref ?? "—"}</Td>
                        <Td>{l.item_name}</Td>
                        <Td>{l.process_done}</Td>
                        <Td>{fmtNum(l.qty)} {l.unit}</Td>
                        <Td>Rs {fmtNum(l.rate)}</Td>
                        <Td className="font-medium">Rs {fmtMoney(l.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                      <Td colSpan={5} className="!text-right">TOTAL</Td>
                      <Td>{fmtNum(totalQty)}</Td>
                      <Td></Td>
                      <Td>Rs {fmtMoney(totalAmount)}</Td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {printing && vendor && (
        <div className="print-only">
          <BillDoc
            vendor={vendor}
            month={month}
            lines={lines}
            totalQty={totalQty}
            totalAmount={totalAmount}
            status={isFinal ? "final" : "draft"}
          />
        </div>
      )}
    </div>
  );
}
