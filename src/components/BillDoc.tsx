import { fmtDate, fmtMonth, fmtMoney, fmtNum } from "@/lib/format";
import type { BillLine, Vendor } from "@/lib/types";

/** Print-friendly month-end job-work bill. Rendered inside a .print-only container. */
export default function BillDoc({
  vendor,
  month,
  lines,
  totalQty,
  totalAmount,
  status,
}: {
  vendor: Pick<Vendor, "name" | "phone" | "address">;
  month: string;
  lines: BillLine[];
  totalQty: number;
  totalAmount: number;
  status: "draft" | "final";
}) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900">
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <h1 className="text-2xl font-bold tracking-wide">MONTHLY JOB WORK BILL</h1>
        <p className="mt-1 text-sm text-slate-600">{fmtMonth(month)}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Bill To (Vendor)</div>
          <div className="mt-1 font-bold">{vendor.name}</div>
          {vendor.address && <div className="text-slate-600">{vendor.address}</div>}
          {vendor.phone && <div className="text-slate-600">{vendor.phone}</div>}
        </div>
        <div className="text-right">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500">Status: </span>
            <span className="font-bold uppercase">{status}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Generated {new Date().toLocaleDateString("en-GB")}
          </div>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse border border-slate-400 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-2 py-2 text-left">Date</th>
            <th className="border border-slate-400 px-2 py-2 text-left">Challan</th>
            <th className="border border-slate-400 px-2 py-2 text-left">Vendor Ref</th>
            <th className="border border-slate-400 px-2 py-2 text-left">Item</th>
            <th className="border border-slate-400 px-2 py-2 text-left">Process</th>
            <th className="border border-slate-400 px-2 py-2 text-right">Qty</th>
            <th className="border border-slate-400 px-2 py-2 text-right">Rate</th>
            <th className="border border-slate-400 px-2 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="border border-slate-400 px-2 py-1.5">{fmtDate(l.date)}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.challan_no}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.vendor_challan_ref ?? "—"}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.item_name}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.process_done}</td>
              <td className="border border-slate-400 px-2 py-1.5 text-right">
                {fmtNum(l.qty)} {l.unit}
              </td>
              <td className="border border-slate-400 px-2 py-1.5 text-right">{fmtMoney(l.rate)}</td>
              <td className="border border-slate-400 px-2 py-1.5 text-right">{fmtMoney(l.amount)}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td colSpan={5} className="border border-slate-400 px-2 py-2 text-right">TOTAL</td>
            <td className="border border-slate-400 px-2 py-2 text-right">{fmtNum(totalQty)}</td>
            <td className="border border-slate-400 px-2 py-2"></td>
            <td className="border border-slate-400 px-2 py-2 text-right">Rs {fmtMoney(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="border-t border-slate-400 pt-2 text-center text-slate-600">Received by (Vendor)</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-2 text-center text-slate-600">For Factory</div>
        </div>
      </div>
    </div>
  );
}
