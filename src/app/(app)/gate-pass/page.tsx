import { createClient } from "@/lib/supabase/server";
import GatePassClient from "./GatePassClient";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GatePassPage() {
  const supabase = createClient();
  const { data } = await supabase.from("vendors").select("id, name").order("name");
  return <GatePassClient vendors={(data ?? []) as Pick<Vendor, "id" | "name">[]} />;
}
