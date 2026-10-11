"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardHeader, Field, TextInput, TextArea, PrimaryButton, SecondaryButton,
  DangerButton, ErrorAlert, EmptyState, Badge, Th, Td,
} from "@/components/ui";
import { fmtNum } from "@/lib/format";
import type { Vendor, RateCard } from "@/lib/types";

const emptyRate = { item_name: "", process_name: "", rate: "", unit: "pcs" };

export default function VendorsClient({ initialVendors }: { initialVendors: Vendor[] }) {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [selectedId, setSelectedId] = useState<string | null>(initialVendors[0]?.id ?? null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [rates, setRates] = useState<RateCard[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateForm, setRateForm] = useState(emptyRate);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  const selected = vendors.find((v) => v.id === selectedId) ?? null;

  async function refreshVendors(selectId?: string) {
    const { data, error } = await supabase.from("vendors").select("*").order("name");
    if (!error && data) {
      setVendors(data as Vendor[]);
      if (selectId) setSelectedId(selectId);
      else if (!data.find((v: Vendor) => v.id === selectedId) && data.length > 0)
        setSelectedId((data[0] as Vendor).id);
    }
  }

  async function loadRates(vendorId: string) {
    setRatesLoading(true);
    const { data, error } = await supabase
      .from("rate_cards")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("item_name")
      .order("process_name");
    setRatesLoading(false);
    if (!error) setRates((data ?? []) as RateCard[]);
  }

  useEffect(() => {
    if (selectedId) loadRates(selectedId);
    else setRates([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function openAdd() {
    setForm({ name: "", phone: "", address: "", notes: "" });
    setEditing(null);
    setShowAdd(true);
    setError(null);
  }

  function openEdit(v: Vendor) {
    setForm({ name: v.name, phone: v.phone ?? "", address: v.address ?? "", notes: v.notes ?? "" });
    setEditing(v);
    setShowAdd(true);
    setError(null);
  }

  async function saveVendor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    let res;
    if (editing) res = await supabase.from("vendors").update(payload).eq("id", editing.id).select("id").single();
    else res = await supabase.from("vendors").insert(payload).select("id").single();
    setSaving(false);
    if (res.error) {
      setError(res.error.code === "23505" ? "A vendor with this name already exists." : res.error.message);
      return;
    }
    setShowAdd(false);
    await refreshVendors(res.data?.id);
  }

  async function deleteVendor(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"? This also deletes their rate card, challans and bills.`)) return;
    const { error } = await supabase.from("vendors").delete().eq("id", v.id);
    if (error) {
      setError(error.message);
      return;
    }
    setSelectedId(null);
    await refreshVendors();
  }

  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    setRateError(null);
    if (!selectedId) return;
    if (!rateForm.item_name.trim() || !rateForm.process_name.trim()) {
      setRateError("Item and process are required.");
      return;
    }
    const rate = parseFloat(rateForm.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      setRateError("Rate must be a number ≥ 0.");
      return;
    }
    const payload = {
      vendor_id: selectedId,
      item_name: rateForm.item_name.trim(),
      process_name: rateForm.process_name.trim(),
      rate,
      unit: rateForm.unit.trim() || "pcs",
      updated_at: new Date().toISOString(),
    };
    let res;
    if (editingRateId)
      res = await supabase.from("rate_cards").update(payload).eq("id", editingRateId);
    else res = await supabase.from("rate_cards").insert(payload);
    if (res.error) {
      setRateError(res.error.code === "23505" ? "This item + process already has a rate for this vendor. Edit it instead." : res.error.message);
      return;
    }
    setRateForm(emptyRate);
    setEditingRateId(null);
    await loadRates(selectedId);
  }

  async function deleteRate(r: RateCard) {
    if (!confirm(`Delete rate for "${r.item_name}" / "${r.process_name}"?`)) return;
    const { error } = await supabase.from("rate_cards").delete().eq("id", r.id);
    if (error) {
      setRateError(error.message);
      return;
    }
    if (selectedId) await loadRates(selectedId);
  }

  function startEditRate(r: RateCard) {
    setRateForm({ item_name: r.item_name, process_name: r.process_name, rate: String(r.rate), unit: r.unit });
    setEditingRateId(r.id);
    setRateError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
        <p className="mt-1 text-sm text-slate-500">Your fixed vendors and their rate cards.</p>
      </div>

      <ErrorAlert message={error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Vendor list */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Vendors"
            action={
              <SecondaryButton onClick={openAdd} className="!px-3 !py-1.5">
                + Add
              </SecondaryButton>
            }
          />
          {vendors.length === 0 ? (
            <EmptyState message="No vendors yet. Add your first vendor to get started." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {vendors.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => setSelectedId(v.id)}
                    className={`flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50 ${
                      v.id === selectedId ? "bg-brand-50" : ""
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{v.name}</div>
                      {v.phone && <div className="text-xs text-slate-500">{v.phone}</div>}
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(v)}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteVendor(v)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Rate card */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={selected ? `Rate card — ${selected.name}` : "Rate card"}
            subtitle="Fixed rate per item + process. The rate is copied onto each outward challan, so changing it later never alters old bills."
          />
          {!selected ? (
            <EmptyState message="Select a vendor to manage their rate card." />
          ) : (
            <div className="px-5 py-4">
              <ErrorAlert message={rateError} />
              <form onSubmit={saveRate} className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <Field label="Item" required>
                  <TextInput value={rateForm.item_name} onChange={(e) => setRateForm({ ...rateForm, item_name: e.target.value })} placeholder="e.g. Shirt" />
                </Field>
                <Field label="Process" required>
                  <TextInput value={rateForm.process_name} onChange={(e) => setRateForm({ ...rateForm, process_name: e.target.value })} placeholder="e.g. Stitching" />
                </Field>
                <Field label="Rate (Rs)" required>
                  <TextInput type="number" min="0" step="0.01" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} placeholder="25" />
                </Field>
                <Field label="Unit">
                  <TextInput value={rateForm.unit} onChange={(e) => setRateForm({ ...rateForm, unit: e.target.value })} placeholder="pcs" />
                </Field>
                <div className="flex items-end gap-2">
                  <PrimaryButton type="submit" className="!px-3">
                    {editingRateId ? "Update" : "Add"}
                  </PrimaryButton>
                  {editingRateId && (
                    <SecondaryButton type="button" onClick={() => { setEditingRateId(null); setRateForm(emptyRate); }} className="!px-3">
                      Cancel
                    </SecondaryButton>
                  )}
                </div>
              </form>

              {ratesLoading ? (
                <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
              ) : rates.length === 0 ? (
                <EmptyState message="No rates yet. Add the fixed rate for each item + process this vendor sends." />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <Th>Item</Th>
                        <Th>Process</Th>
                        <Th>Rate</Th>
                        <Th>Unit</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rates.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <Td className="font-medium">{r.item_name}</Td>
                          <Td>{r.process_name}</Td>
                          <Td>Rs {fmtNum(r.rate)}</Td>
                          <Td>{r.unit}</Td>
                          <Td>
                            <div className="flex gap-3">
                              <button onClick={() => startEditRate(r)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                              <button onClick={() => deleteRate(r)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Tip: set the rate once per item/process. Outward challans copy it automatically — you can still override it per challan.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Add / edit vendor inline form */}
      {showAdd && (
        <Card>
          <CardHeader title={editing ? `Edit vendor — ${editing.name}` : "Add vendor"} />
          <form onSubmit={saveVendor} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
            <Field label="Vendor name" required>
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Textiles" />
            </Field>
            <Field label="Phone">
              <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03xx-xxxxxxx" />
            </Field>
            <Field label="Address">
              <TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Factory address" />
            </Field>
            <Field label="Notes">
              <TextArea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes" />
            </Field>
            <div className="flex gap-3 md:col-span-2">
              <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update vendor" : "Add vendor"}</PrimaryButton>
              <SecondaryButton type="button" onClick={() => setShowAdd(false)}>Cancel</SecondaryButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
