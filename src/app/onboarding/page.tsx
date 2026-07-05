import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const ctx = await requireUser();
  const membership = await db.businessMember.findFirst({ where: { userId: ctx.user.id } });
  if (membership) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <OnboardingForm defaultEmail={ctx.user.email} />
    </main>
  );
}
