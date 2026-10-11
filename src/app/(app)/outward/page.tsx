import { createClient } from "@/lib/supabase/server";
import OutwardClient from "./OutwardClient";
import type { Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OutwardPage() {
  const supabase = createClient();
  const { data } = await supabase.from("vendors").select("id, name").order("name");
  return <OutwardClient vendors={(data ?? []) as Pick<Vendor, "id" | "name">[]} />;
}
