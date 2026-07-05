"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessSchema } from "@/lib/validators";

export async function createBusiness(_prev: unknown, formData: FormData) {
  const ctx = await requireUser();
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();

  // one business per user in V1
  const { data: existing } = await supabase
    .from("business_members").select("id").eq("user_id", ctx.user.id).limit(1).maybeSingle();
  if (existing) redirect("/dashboard");

  const { data: slugTaken } = await supabase
    .from("businesses").select("id").eq("slug", d.slug).maybeSingle();
  if (slugTaken) return { error: "Ce slug est déjà pris, choisis-en un autre." };

  const { data: business, error } = await supabase
    .from("businesses")
    .insert({
      name: d.name, slug: d.slug, email: d.email,
      phone: d.phone || null, address: d.address || null,
      business_type: d.business_type, logo_url: d.logo_url || null,
      cancellation_policy: d.cancellation_policy || null,
    })
    .select("id").single();
  if (error || !business) return { error: "Création impossible : " + (error?.message ?? "inconnu") };

  const { error: memberErr } = await supabase
    .from("business_members")
    .insert({ business_id: business.id, user_id: ctx.user.id, role: "owner" });
  if (memberErr) return { error: "Erreur membership : " + memberErr.message };

  await supabase.from("business_settings").insert({ business_id: business.id });
  // default availability: Mon–Sat 9:00–18:00
  await supabase.from("availability_rules").insert(
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      business_id: business.id, weekday, start_time: "09:00", end_time: "18:00",
    }))
  );

  redirect("/dashboard");
}
