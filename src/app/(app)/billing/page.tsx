import { createClient } from "@/lib/supabase/server";
import BillingClient from "./BillingClient";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = createClient();
  const { data } = await supabase.from("vendors").select("id, name, phone, address").order("name");
  return <BillingClient vendors={(data ?? []) as Pick<Vendor, "id" | "name" | "phone" | "address">[]} />;
}
