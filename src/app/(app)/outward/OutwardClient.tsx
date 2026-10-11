"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardHeader, Field, TextInput, SelectInput, TextArea, PrimaryButton,
  ErrorAlert, EmptyState, Th, Td,
} from "@/components/ui";
import ChallanDoc from "@/components/ChallanDoc";
import { todayISO, fmtDate, fmtNum, fmtMoney } from "@/lib/format";
import type { Vendor, InwardChallan, OutwardChallan, RateCard } from "@/lib/types";

const emptyForm = {
  vendor_id: "",
  inward_id: "",
  challan_date: todayISO(),
  item_name: "",
  qty: "",
  unit: "pcs",
  process_done: "",
  rate: "",
  notes: "",
};

interface PendingInward extends InwardChallan {
  remaining: number;
}

export default function OutwardClient({ vendors }: { vendors: Pick<Vendor, "id" | "name">[] }) {
  const supabase = createClient();
  const [list, setList] = useState<OutwardChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterVendor, setFilterVendor] = useState("");

  const [pending, setPending] = useState<PendingInward[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [printItem, setPrintItem] = useState<OutwardChallan | null>(null);
  const rateTouched = useRef(false);

  async function loadList() {
    setLoading(true);
    let q = supabase
      .from("outward_challans")
      .select("*, vendor:vendors(id, name, phone, address)")
      .order("challan_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (filterVendor) q = q.eq("vendor_id", filterVendor);
    const { data, error } = await q;
    setLoading(false);
    if (!error) setList((data ?? []) as unknown as OutwardChallan[]);
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVendor]);

  // Load pending inwards + rate cards whenever the vendor changes
  useEffect(() => {
    async function loadVendorData() {
      if (!form.vendor_id) {
        setPending([]);
        setRateCards([]);
        return;
      }
      const [{ data: inwards }, { data: cards }] = await Promise.all([
        supabase
          .from("inward_challans")
          .select("*")
          .eq("vendor_id", form.vendor_id)
          .in("status", ["pending", "partial"])
          .order("challan_date", { ascending: true }),
        supabase.from("rate_cards").select("*").eq("vendor_id", form.vendor_id),
      ]);
      const inList = (inwards ?? []) as InwardChallan[];
      const ids = inList.map((i) => i.id);
      let sums: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: outs } = await supabase
          .from("outward_challans")
          .select("inward_id, qty")
          .in("inward_id", ids);
        sums = {};
        (outs ?? []).forEach((o: { inward_id: string | null; qty: number }) => {
          if (o.inward_id) sums[o.inward_id] = (sums[o.inward_id] ?? 0) + Number(o.qty);
        });
      }
      setPending(
        inList.map((i) => ({ ...i, remaining: Math.max(0, Number(i.qty) - (sums[i.id] ?? 0)) }))
      );
      setRateCards((cards ?? []) as RateCard[]);
    }
    loadVendorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendor_id]);

  // Auto-fill rate from the vendor's rate card when item + process match
  useEffect(() => {
    if (rateTouched.current) return;
    if (!form.item_name.trim() || !form.process_done.trim()) return;
    const match = rateCards.find(
      (r) =>
        r.item_name.trim().toLowerCase() === form.item_name.trim().toLowerCase() &&
        r.process_name.trim().toLowerCase() === form.process_done.trim().toLowerCase()
    );
    if (match) {
      setForm((f) => ({ ...f, rate: String(match.rate), unit: f.unit === "pcs" || !f.unit ? match.unit : f.unit }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.item_name, form.process_done, rateCards]);

  function onInwardSelect(inwardId: string) {
    const inw = pending.find((p) => p.id === inwardId);
    rateTouched.current = false;
    if (!inw) {
      setForm((f) => ({ ...f, inward_id: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      inward_id: inw.id,
      item_name: inw.item_name,
      qty: String(inw.remaining > 0 ? inw.remaining : inw.qty),
      unit: inw.unit,
      process_done: inw.process_required,
      notes: f.notes,
    }));
  }

  const qtyNum = parseFloat(form.qty);
  const rateNum = parseFloat(form.rate);
  const amountPreview =
    Number.isFinite(qtyNum) && Number.isFinite(rateNum) ? qtyNum * rateNum : 0;

  async function insertWithChallanNo(payload: Record<string, unknown>, attempt = 0) {
    const { data: challanNo, error: rpcError } = await supabase.rpc("next_challan_no");
    if (rpcError) return { data: null, error: rpcError };
    const { data, error } = await supabase
      .from("outward_challans")
      .insert({ ...payload, challan_no: challanNo as string })
      .select()
      .single();
    // Extremely rare collision: retry with a fresh number
    if (error && error.code === "23505" && attempt < 3) {
      return insertWithChallanNo(payload, attempt + 1);
    }
    return { data: data as OutwardChallan | null, error };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.vendor_id) return setError("Select a vendor.");
    if (!form.challan_date) return setError("Date is required.");
    if (!form.item_name.trim()) return setError("Item name is required.");
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return setError("Quantity must be greater than 0.");
    if (!form.process_done.trim()) return setError("Process done is required.");
    if (!Number.isFinite(rateNum) || rateNum < 0) return setError("Rate must be a number ≥ 0.");

    const inw = pending.find((p) => p.id === form.inward_id);

    setSaving(true);
    const { data, error } = await insertWithChallanNo({
      vendor_id: form.vendor_id,
      inward_id: form.inward_id || null,
      challan_date: form.challan_date,
      vendor_challan_ref: inw ? inw.vendor_challan_no : null,
      item_name: form.item_name.trim(),
      qty: qtyNum,
      unit: form.unit.trim() || "pcs",
      process_done: form.process_done.trim(),
      rate: rateNum, // snapshot — later rate-card changes never alter this line
      notes: form.notes.trim() || null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    // Refresh lists (inward status is synced by the DB trigger)
    rateTouched.current = false;
    const savedVendorId = form.vendor_id;
    setForm({ ...emptyForm, vendor_id: savedVendorId });
    await loadList();
    // Reload pending inwards for the vendor (recompute remaining via fresh query)
    const { data: inwards } = await supabase
      .from("inward_challans")
      .select("*")
      .eq("vendor_id", savedVendorId)
      .in("status", ["pending", "partial"])
      .order("challan_date", { ascending: true });
    const inList = (inwards ?? []) as InwardChallan[];
    const ids = inList.map((i) => i.id);
    let sums: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: outs } = await supabase
        .from("outward_challans")
        .select("inward_id, qty")
        .in("inward_id", ids);
      (outs ?? []).forEach((o: { inward_id: string | null; qty: number }) => {
        if (o.inward_id) sums[o.inward_id] = (sums[o.inward_id] ?? 0) + Number(o.qty);
      });
    }
    setPending(inList.map((i) => ({ ...i, remaining: Math.max(0, Number(i.qty) - (sums[i.id] ?? 0)) })));
    // Load the saved challan with vendor details for the optional printout
    if (data) {
      const { data: full } = await supabase
        .from("outward_challans")
        .select("*, vendor:vendors(id, name, phone, address)")
        .eq("id", (data as OutwardChallan).id)
        .single();
      if (full) setPrintItem(full as unknown as OutwardChallan);
    }
  }

  function doPrint(item: OutwardChallan) {
    setPrintItem(item);
  }

  useEffect(() => {
    if (!printItem) return;
    const t = setTimeout(() => window.print(), 80);
    const clear = () => setPrintItem(null);
    window.addEventListener("afterprint", clear);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", clear);
    };
  }, [printItem]);

  return (
    <div>
      <div className={printItem ? "no-print" : ""}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Outward Challans</h1>
            <p className="mt-1 text-sm text-slate-500">
              Your challan issued to the vendor after the work is done. The rate is copied from the rate card and frozen on the challan.
            </p>
          </div>

          <Card>
            <CardHeader title="New outward challan" subtitle="Challan number is auto-generated (JW-0001, JW-0002, …)." />
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <ErrorAlert message={error} />
              </div>
              <Field label="Vendor" required>
                <SelectInput
                  value={form.vendor_id}
                  onChange={(e) => {
                    rateTouched.current = false;
                    setForm({ ...emptyForm, vendor_id: e.target.value });
                  }}
                >
                  <option value="">— Select vendor —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Link pending inward (optional)" hint="Autofills item, qty and process.">
                <SelectInput value={form.inward_id} onChange={(e) => onInwardSelect(e.target.value)} disabled={!form.vendor_id}>
                  <option value="">— No link —</option>
                  {pending.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.vendor_challan_no} — {p.item_name} ({fmtNum(p.remaining)} {p.unit} left) — {fmtDate(p.challan_date)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Date" required>
                <TextInput type="date" value={form.challan_date} onChange={(e) => setForm({ ...form, challan_date: e.target.value })} />
              </Field>
              <Field label="Item" required>
                <TextInput value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Shirt" />
              </Field>
              <Field label="Qty" required>
                <TextInput type="number" min="0" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="1000" />
              </Field>
              <Field label="Unit">
                <TextInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
              </Field>
              <Field label="Process done" required>
                <TextInput value={form.process_done} onChange={(e) => setForm({ ...form, process_done: e.target.value })} placeholder="e.g. Stitching" />
              </Field>
              <Field label="Rate (Rs)" required hint="Auto-filled from the rate card; you can override it.">
                <TextInput
                  type="number" min="0" step="0.01" value={form.rate}
                  onChange={(e) => { rateTouched.current = true; setForm({ ...form, rate: e.target.value }); }}
                  placeholder="25"
                />
              </Field>
              <Field label="Amount (Rs)">
                <TextInput value={fmtMoney(amountPreview)} disabled />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <TextArea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                </Field>
              </div>
              <div className="flex items-end">
                <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save outward challan"}</PrimaryButton>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Outward history"
              action={
                <SelectInput value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="!w-auto">
                  <option value="">All vendors</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </SelectInput>
              }
            />
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : list.length === 0 ? (
              <EmptyState message="No outward challans yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <Th>Challan No</Th>
                      <Th>Date</Th>
                      <Th>Vendor</Th>
                      <Th>Item</Th>
                      <Th>Qty</Th>
                      <Th>Process</Th>
                      <Th>Rate</Th>
                      <Th>Amount</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <Td className="font-semibold">{c.challan_no}</Td>
                        <Td>{fmtDate(c.challan_date)}</Td>
                        <Td>{c.vendor?.name ?? "—"}</Td>
                        <Td>{c.item_name}</Td>
                        <Td>{fmtNum(c.qty)} {c.unit}</Td>
                        <Td>{c.process_done}</Td>
                        <Td>Rs {fmtNum(c.rate)}</Td>
                        <Td className="font-medium">Rs {fmtMoney(c.amount)}</Td>
                        <Td>
                          <button onClick={() => doPrint(c)} className="text-xs font-semibold text-brand-600 hover:underline">
                            Print
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {printItem && (
        <div className="print-only">
          <ChallanDoc challan={printItem} />
        </div>
      )}
    </div>
  );
}
