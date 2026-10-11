"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardHeader, Field, TextInput, SelectInput, TextArea, PrimaryButton,
  ErrorAlert, EmptyState, Badge, Th, Td,
} from "@/components/ui";
import GatePassDoc from "@/components/GatePassDoc";
import { todayISO, fmtDate, fmtNum } from "@/lib/format";
import type { Vendor, GatePass, GatePassType } from "@/lib/types";

const emptyForm = {
  type: "outward" as GatePassType,
  gp_date: todayISO(),
  vendor_id: "",
  challan_ref: "",
  vehicle_no: "",
  driver_name: "",
  item_name: "",
  qty: "",
  unit: "pcs",
  purpose: "",
  remarks: "",
};

const GP_SELECT = "*, vendor:vendors(id, name, phone, address)";

export default function GatePassClient({ vendors }: { vendors: Pick<Vendor, "id" | "name">[] }) {
  const supabase = createClient();
  const [list, setList] = useState<GatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterVendor, setFilterVendor] = useState("");
  const [filterType, setFilterType] = useState("");

  const [printItem, setPrintItem] = useState<GatePass | null>(null);

  async function loadList() {
    setLoading(true);
    let q = supabase
      .from("gate_passes")
      .select(GP_SELECT)
      .order("gp_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (filterVendor) q = q.eq("vendor_id", filterVendor);
    if (filterType) q = q.eq("type", filterType);
    const { data, error } = await q;
    setLoading(false);
    if (!error) setList((data ?? []) as unknown as GatePass[]);
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVendor, filterType]);

  const qtyNum = parseFloat(form.qty);

  async function insertWithGpNo(payload: Record<string, unknown>, attempt = 0) {
    const { data: gpNo, error: rpcError } = await supabase.rpc("next_gate_pass_no");
    if (rpcError) return { data: null, error: rpcError };
    const { data, error } = await supabase
      .from("gate_passes")
      .insert({ ...payload, gp_no: gpNo as string })
      .select()
      .single();
    // Extremely rare collision: retry with a fresh number
    if (error && error.code === "23505" && attempt < 3) {
      return insertWithGpNo(payload, attempt + 1);
    }
    return { data: data as GatePass | null, error };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.vendor_id) return setError("Select a vendor.");
    if (!form.gp_date) return setError("Date is required.");
    if (!form.item_name.trim()) return setError("Item name is required.");
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return setError("Quantity must be greater than 0.");

    setSaving(true);
    const { data, error } = await insertWithGpNo({
      gp_date: form.gp_date,
      type: form.type,
      vendor_id: form.vendor_id,
      challan_ref: form.challan_ref.trim() || null,
      vehicle_no: form.vehicle_no.trim() || null,
      driver_name: form.driver_name.trim() || null,
      item_name: form.item_name.trim(),
      qty: qtyNum,
      unit: form.unit.trim() || "pcs",
      purpose: form.purpose.trim() || null,
      remarks: form.remarks.trim() || null,
    });
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    const savedType = form.type;
    const savedVendorId = form.vendor_id;
    setForm({ ...emptyForm, type: savedType, vendor_id: savedVendorId });
    await loadList();
    // Load the saved pass with vendor details for the printout
    if (data) {
      const { data: full } = await supabase
        .from("gate_passes")
        .select(GP_SELECT)
        .eq("id", (data as GatePass).id)
        .single();
      if (full) setPrintItem(full as unknown as GatePass);
    }
  }

  function doPrint(item: GatePass) {
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

  function challanRef(g: GatePass): string {
    return g.challan_ref ?? "—";
  }

  return (
    <div>
      <div className={printItem ? "no-print" : ""}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gate Passes</h1>
            <p className="mt-1 text-sm text-slate-500">
              Gate movement slips for material coming in or going out — with vehicle and driver details.
            </p>
          </div>

          <Card>
            <CardHeader title="New gate pass" subtitle="Gate pass number is auto-generated (GP-0001, GP-0002, …)." />
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <ErrorAlert message={error} />
              </div>
              <Field label="Type" required>
                <SelectInput
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as GatePassType })
                  }
                >
                  <option value="outward">Outward — material going out</option>
                  <option value="inward">Inward — material coming in</option>
                </SelectInput>
              </Field>
              <Field label="Date" required>
                <TextInput type="date" value={form.gp_date} onChange={(e) => setForm({ ...form, gp_date: e.target.value })} />
              </Field>
              <Field label="Vendor" required>
                <SelectInput
                  value={form.vendor_id}
                  onChange={(e) => setForm({ ...emptyForm, type: form.type, vendor_id: e.target.value })}
                >
                  <option value="">— Select vendor —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Challan No.">
                <TextInput value={form.challan_ref} onChange={(e) => setForm({ ...form, challan_ref: e.target.value })} placeholder="Vendor's challan no. or your challan no." />
              </Field>
              <Field label="Vehicle No.">
                <TextInput value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })} placeholder="e.g. KHI-1234" />
              </Field>
              <Field label="Driver Name">
                <TextInput value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} placeholder="e.g. Ahmed Khan" />
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
              <Field label="Purpose">
                <TextInput value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Job-work return" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Remarks">
                  <TextArea rows={1} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional remarks" />
                </Field>
              </div>
              <div className="flex items-end">
                <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save gate pass"}</PrimaryButton>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Gate pass history"
              action={
                <div className="flex gap-2">
                  <SelectInput value={filterType} onChange={(e) => setFilterType(e.target.value)} className="!w-auto">
                    <option value="">All types</option>
                    <option value="inward">Inward</option>
                    <option value="outward">Outward</option>
                  </SelectInput>
                  <SelectInput value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="!w-auto">
                    <option value="">All vendors</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </SelectInput>
                </div>
              }
            />
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : list.length === 0 ? (
              <EmptyState message="No gate passes yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <Th>GP No</Th>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Vendor</Th>
                      <Th>Vehicle</Th>
                      <Th>Item</Th>
                      <Th>Qty</Th>
                      <Th>Challan Ref</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <Td className="font-semibold">{g.gp_no}</Td>
                        <Td>{fmtDate(g.gp_date)}</Td>
                        <Td>
                          <Badge tone={g.type === "inward" ? "blue" : "green"}>
                            {g.type === "inward" ? "Inward" : "Outward"}
                          </Badge>
                        </Td>
                        <Td>{g.vendor?.name ?? "—"}</Td>
                        <Td>{g.vehicle_no ?? "—"}</Td>
                        <Td>{g.item_name}</Td>
                        <Td>{fmtNum(g.qty)} {g.unit}</Td>
                        <Td>{challanRef(g)}</Td>
                        <Td>
                          <button onClick={() => doPrint(g)} className="text-xs font-semibold text-brand-600 hover:underline">
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
          <GatePassDoc pass={printItem} />
        </div>
      )}
    </div>
  );
}
