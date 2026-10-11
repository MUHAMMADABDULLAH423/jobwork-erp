import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import type { OutwardChallan } from "@/lib/types";

/** Print-friendly outward job-work challan. Rendered inside a .print-only container. */
export default function ChallanDoc({ challan }: { challan: OutwardChallan }) {
  const v = challan.vendor;
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900">
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <h1 className="text-2xl font-bold tracking-wide">JOB WORK CHALLAN</h1>
        <p className="mt-1 text-sm text-slate-600">Material returned after processing</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">To (Vendor)</div>
          <div className="mt-1 font-bold">{v?.name ?? "—"}</div>
          {v?.address && <div className="text-slate-600">{v.address}</div>}
          {v?.phone && <div className="text-slate-600">{v.phone}</div>}
        </div>
        <div className="space-y-1 text-right">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500">Challan No: </span>
            <span className="font-bold">{challan.challan_no}</span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500">Date: </span>
            <span>{fmtDate(challan.challan_date)}</span>
          </div>
          {challan.vendor_challan_ref && (
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Vendor Challan Ref: </span>
              <span>{challan.vendor_challan_ref}</span>
            </div>
          )}
        </div>
      </div>

      <table className="mt-6 w-full border-collapse border border-slate-400 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-3 py-2 text-left">Item</th>
            <th className="border border-slate-400 px-3 py-2 text-left">Process Done</th>
            <th className="border border-slate-400 px-3 py-2 text-right">Qty</th>
            <th className="border border-slate-400 px-3 py-2 text-right">Rate (Rs)</th>
            <th className="border border-slate-400 px-3 py-2 text-right">Amount (Rs)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-400 px-3 py-2">{challan.item_name}</td>
            <td className="border border-slate-400 px-3 py-2">{challan.process_done}</td>
            <td className="border border-slate-400 px-3 py-2 text-right">
              {fmtNum(challan.qty)} {challan.unit}
            </td>
            <td className="border border-slate-400 px-3 py-2 text-right">{fmtMoney(challan.rate)}</td>
            <td className="border border-slate-400 px-3 py-2 text-right font-semibold">
              {fmtMoney(challan.amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {challan.notes && (
        <div className="mt-4 text-sm">
          <span className="font-semibold">Notes: </span>
          <span className="text-slate-600">{challan.notes}</span>
        </div>
      )}

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
