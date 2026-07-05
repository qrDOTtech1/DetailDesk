"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function toggleBusinessTest(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const b = await db.business.findUnique({ where: { id }, select: { isTest: true } });
  if (b) await db.business.update({ where: { id }, data: { isTest: !b.isTest } });
  revalidatePath("/admin/businesses");
}

export async function toggleBusinessActive(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const b = await db.business.findUnique({ where: { id }, select: { isActive: true } });
  if (b) await db.business.update({ where: { id }, data: { isActive: !b.isActive } });
  revalidatePath("/admin/businesses");
}
