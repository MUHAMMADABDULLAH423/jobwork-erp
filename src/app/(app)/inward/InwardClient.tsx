"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardHeader, Field, TextInput, SelectInput, TextArea, PrimaryButton,
  SecondaryButton, ErrorAlert, EmptyState, Badge, statusTone, Th, Td,
} from "@/components/ui";
import { todayISO, fmtDate, fmtNum } from "@/lib/format";
import type { Vendor, InwardChallan } from "@/lib/types";

const emptyForm = {
  vendor_id: "",
  vendor_challan_no: "",
  challan_date: todayISO(),
  item_name: "",
  qty: "",
  unit: "pcs",
  process_required: "",
  notes: "",
};

export default function InwardClient({ vendors }: { vendors: Pick<Vendor, "id" | "name">[] }) {
  const supabase = createClient();
  const [list, setList] = useState<InwardChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterVendor, setFilterVendor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  async function load() {
    setLoading(true);
    let q = supabase
      .from("inward_challans")
      .select("*, vendor:vendors(id, name)")
      .order("challan_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (filterVendor) q = q.eq("vendor_id", filterVendor);
    if (filterStatus) q = q.eq("status", filterStatus);
    const { data, error } = await q;
    setLoading(false);
    if (!error) setList((data ?? []) as unknown as InwardChallan[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVendor, filterStatus]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.vendor_id) return setError("Select a vendor.");
    if (!form.vendor_challan_no.trim()) return setError("Vendor challan number is required.");
    if (!form.challan_date) return setError("Date is required.");
    if (!form.item_name.trim()) return setError("Item name is required.");
    const qty = parseFloat(form.qty);
    if (!Number.isFinite(qty) || qty <= 0) return setError("Quantity must be greater than 0.");
    if (!form.process_required.trim()) return setError("Required process is required.");

    setSaving(true);
    const { error } = await supabase.from("inward_challans").insert({
      vendor_id: form.vendor_id,
      vendor_challan_no: form.vendor_challan_no.trim(),
      challan_date: form.challan_date,
      item_name: form.item_name.trim(),
      qty,
      unit: form.unit.trim() || "pcs",
      process_required: form.process_required.trim(),
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ ...emptyForm, vendor_id: form.vendor_id });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inward Challans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Material received from vendors with <em>their</em> challan number.
        </p>
      </div>

      <Card>
        <CardHeader title="New inward entry" subtitle="Note the vendor's challan number here — it becomes a pending job." />
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
          <ErrorAlert message={error} />
          <Field label="Vendor" required>
            <SelectInput value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
              <option value="">— Select vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Vendor challan no." required>
            <TextInput value={form.vendor_challan_no} onChange={(e) => setForm({ ...form, vendor_challan_no: e.target.value })} placeholder="e.g. VC-4521" />
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
          <Field label="Process required" required>
            <TextInput value={form.process_required} onChange={(e) => setForm({ ...form, process_required: e.target.value })} placeholder="e.g. Stitching" />
          </Field>
          <Field label="Notes">
            <TextArea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </Field>
          <div className="flex items-end">
            <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save inward entry"}</PrimaryButton>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Inward history"
          action={
            <div className="flex gap-2">
              <SelectInput value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="!w-auto">
                <option value="">All vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </SelectInput>
              <SelectInput value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="!w-auto">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
              </SelectInput>
            </div>
          }
        />
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState message="No inward entries found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Vendor</Th>
                  <Th>Vendor Challan</Th>
                  <Th>Item</Th>
                  <Th>Qty</Th>
                  <Th>Process Required</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <Td>{fmtDate(c.challan_date)}</Td>
                    <Td className="font-medium">{c.vendor?.name ?? "—"}</Td>
                    <Td>{c.vendor_challan_no}</Td>
                    <Td>{c.item_name}</Td>
                    <Td>{fmtNum(c.qty)} {c.unit}</Td>
                    <Td>{c.process_required}</Td>
                    <Td><Badge tone={statusTone(c.status)}>{c.status}</Badge></Td>
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
