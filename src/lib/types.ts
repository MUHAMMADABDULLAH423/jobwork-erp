export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface RateCard {
  id: string;
  vendor_id: string;
  item_name: string;
  process_name: string;
  rate: number;
  unit: string;
  updated_at: string;
}

export type InwardStatus = "pending" | "partial" | "completed";

export interface InwardChallan {
  id: string;
  vendor_id: string;
  vendor_challan_no: string;
  challan_date: string; // YYYY-MM-DD
  item_name: string;
  qty: number;
  unit: string;
  process_required: string;
  status: InwardStatus;
  notes: string | null;
  created_at: string;
  vendor?: Pick<Vendor, "id" | "name"> | null;
}

export interface OutwardChallan {
  id: string;
  challan_no: string;
  vendor_id: string;
  inward_id: string | null;
  challan_date: string; // YYYY-MM-DD
  vendor_challan_ref: string | null;
  item_name: string;
  qty: number;
  unit: string;
  process_done: string;
  rate: number; // snapshot from the rate card at entry time
  amount: number; // always qty * rate (kept by DB trigger)
  notes: string | null;
  created_at: string;
  vendor?: Pick<Vendor, "id" | "name" | "phone" | "address"> | null;
}

export interface BillLine {
  date: string; // YYYY-MM-DD
  challan_no: string;
  vendor_challan_ref: string | null;
  item_name: string;
  process_done: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export type BillStatus = "draft" | "final";

export interface MonthBill {
  id: string;
  vendor_id: string;
  month: string; // YYYY-MM
  total_qty: number;
  total_amount: number;
  status: BillStatus;
  lines: BillLine[];
  created_at: string;
}

export type GatePassType = "inward" | "outward";

export interface GatePass {
  id: string;
  gp_no: string;
  gp_date: string; // YYYY-MM-DD
  type: GatePassType;
  vendor_id: string;
  challan_ref: string | null;
  vehicle_no: string | null;
  driver_name: string | null;
  item_name: string;
  qty: number;
  unit: string;
  purpose: string | null;
  remarks: string | null;
  created_at: string;
  vendor?: Pick<Vendor, "id" | "name" | "phone" | "address"> | null;
}
