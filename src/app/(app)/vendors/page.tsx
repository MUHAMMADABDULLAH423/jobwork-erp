import { createClient } from "@/lib/supabase/server";
import VendorsClient from "./VendorsClient";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("vendors").select("*").order("name");
  return <VendorsClient initialVendors={(data ?? []) as Vendor[]} />;
}
