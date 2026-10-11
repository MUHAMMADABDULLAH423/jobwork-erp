import { createClient } from "@/lib/supabase/server";
import InwardClient from "./InwardClient";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InwardPage() {
  const supabase = createClient();
  const { data } = await supabase.from("vendors").select("id, name").order("name");
  return <InwardClient vendors={(data ?? []) as Pick<Vendor, "id" | "name">[]} />;
}
