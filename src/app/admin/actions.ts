"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function toggleBusinessTest(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { data: b } = await supabase.from("businesses").select("is_test").eq("id", id).single();
  if (b) await supabase.from("businesses").update({ is_test: !b.is_test }).eq("id", id);
  revalidatePath("/admin/businesses");
}

export async function toggleBusinessActive(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const supabase = createAdminClient();
  const { data: b } = await supabase.from("businesses").select("is_active").eq("id", id).single();
  if (b) await supabase.from("businesses").update({ is_active: !b.is_active }).eq("id", id);
  revalidatePath("/admin/businesses");
}
