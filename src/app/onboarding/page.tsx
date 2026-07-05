import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const ctx = await requireUser();
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("business_members").select("id").eq("user_id", ctx.user.id).limit(1).maybeSingle();
  if (membership) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <OnboardingForm defaultEmail={ctx.user.email} />
    </main>
  );
}
