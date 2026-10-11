import { fmtDate, fmtNum } from "@/lib/format";
import type { GatePass } from "@/lib/types";

/** Print-friendly factory gate pass. Rendered inside a .print-only container. */
export default function GatePassDoc({ pass }: { pass: GatePass }) {
  const v = pass.vendor;
  const challanRef = pass.challan_ref ?? null;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900">
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          JobWork ERP — Factory Gate Pass
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-wide">GATE PASS</h1>
        <p className="mt-1 text-sm text-slate-600">
          {pass.type === "inward" ? "Material IN — received at gate" : "Material OUT — dispatched from gate"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">
            {pass.type === "inward" ? "From (Vendor)" : "To (Vendor)"}
          </div>
          <div className="mt-1 font-bold">{v?.name ?? "—"}</div>
          {v?.address && <div className="text-slate-600">{v.address}</div>}
          {v?.phone && <div className="text-slate-600">{v.phone}</div>}
        </div>
        <div className="space-y-1 text-right">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500">Gate Pass No: </span>
            <span className="font-bold">{pass.gp_no}</span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500">Date: </span>
            <span>{fmtDate(pass.gp_date)}</span>
          </div>
          {challanRef && (
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500">Challan No: </span>
              <span>{challanRef}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs font-semibold uppercase text-slate-500">Vehicle No: </span>
          <span className="font-semibold">{pass.vehicle_no ?? "—"}</span>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase text-slate-500">Driver Name: </span>
          <span className="font-semibold">{pass.driver_name ?? "—"}</span>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse border border-slate-400 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-3 py-2 text-left">Item</th>
            <th className="border border-slate-400 px-3 py-2 text-right">Qty</th>
            <th className="border border-slate-400 px-3 py-2 text-left">Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-400 px-3 py-2 font-medium">{pass.item_name}</td>
            <td className="border border-slate-400 px-3 py-2 text-right">
              {fmtNum(pass.qty)} {pass.unit}
            </td>
            <td className="border border-slate-400 px-3 py-2">{pass.purpose ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      {pass.remarks && (
        <div className="mt-4 text-sm">
          <span className="font-semibold">Remarks: </span>
          <span className="text-slate-600">{pass.remarks}</span>
        </div>
      )}

      <div className="mt-12 grid grid-cols-3 gap-8 text-sm">
        <div>
          <div className="border-t border-slate-400 pt-2 text-center text-slate-600">Issued By</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-2 text-center text-slate-600">Security</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-2 text-center text-slate-600">Received By</div>
        </div>
      </div>
    </div>
  );
}
