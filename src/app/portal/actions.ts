"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getPortalSession, destroyPortalSession } from "@/lib/portal-auth";

export async function portalSignOut() {
  await destroyPortalSession();
  redirect("/");
}

/** Customer toggles their own public-photos consent from the portal. */
export async function setPortalConsent(formData: FormData) {
  const session = await getPortalSession();
  if (!session) redirect("/");
  const granted = String(formData.get("granted")) === "true";

  await db.customerConsent.upsert({
    where: { customerId_consentType: { customerId: session.customerId, consentType: "public_photos" } },
    create: {
      businessId: session.businessId, customerId: session.customerId,
      consentType: "public_photos", granted,
      grantedAt: granted ? new Date() : null,
      revokedAt: granted ? null : new Date(),
      source: "portal",
    },
    update: {
      granted,
      grantedAt: granted ? new Date() : undefined,
      revokedAt: granted ? null : new Date(),
      source: "portal",
    },
  });
  revalidatePath("/portal");
}
