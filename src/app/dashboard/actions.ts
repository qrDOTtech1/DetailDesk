"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, appUrl } from "@/lib/stripe";
import { sendEmail } from "@/lib/mailer";
import { bookingCancelledEmail } from "@/lib/emails";
import {
  serviceSchema, customerSchema, vehicleSchema, availabilityRuleSchema,
  blockedSlotSchema, settingsSchema, businessSchema, bookingStatusSchema, addonSchema,
} from "@/lib/validators";

type ActionState = { error?: string; success?: string } | null;

/* ─────────── SERVICES ─────────── */

export async function upsertService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const raw = Object.fromEntries(formData);
  const parsed = serviceSchema.safeParse({
    ...raw,
    deposit_required: raw.deposit_required === "on" || raw.deposit_required === "true",
    is_active: raw.is_active === "on" || raw.is_active === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const data = {
    name: parsed.data.name, description: parsed.data.description || null,
    category: parsed.data.category,
    priceCents: Math.round(parsed.data.price_euros * 100),
    durationMinutes: parsed.data.duration_minutes, depositRequired: parsed.data.deposit_required,
    depositType: parsed.data.deposit_type,
    // fixed deposits are entered in euros; percent stays a percentage
    depositValue: parsed.data.deposit_type === "fixed"
      ? Math.round(parsed.data.deposit_value * 100)
      : Math.round(parsed.data.deposit_value),
    rebookAfterDays: parsed.data.rebook_after_days > 0 ? parsed.data.rebook_after_days : null,
    isActive: parsed.data.is_active,
  };

  if (id) {
    await db.service.updateMany({ where: { id, businessId: ctx.business.id }, data });
  } else {
    await db.service.create({ data: { ...data, businessId: ctx.business.id } });
  }
  revalidatePath("/dashboard/services");
  return { success: "Service enregistré." };
}

export async function deleteService(formData: FormData) {
  const ctx = await requireBusiness();
  await db.service.updateMany({
    where: { id: String(formData.get("id")), businessId: ctx.business.id },
    data: { isActive: false },
  });
  revalidatePath("/dashboard/services");
}

/* ─────────── CUSTOMERS ─────────── */

export async function upsertCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const data = {
    fullName: parsed.data.full_name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
  };
  if (id) {
    await db.customer.updateMany({ where: { id, businessId: ctx.business.id }, data });
  } else {
    await db.customer.create({ data: { ...data, businessId: ctx.business.id } });
  }
  revalidatePath("/dashboard/customers");
  return { success: "Client enregistré." };
}

/* ─────────── VEHICLES ─────────── */

export async function upsertVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const customer = await db.customer.findFirst({
    where: { id: parsed.data.customer_id, businessId: ctx.business.id },
  });
  if (!customer) return { error: "Client introuvable." };

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const data = {
    customerId: parsed.data.customer_id,
    make: parsed.data.make, model: parsed.data.model,
    year: parsed.data.year || null, plate: parsed.data.plate || null,
    sizeCategory: parsed.data.size_category ?? "other",
    notes: parsed.data.notes || null,
  };
  if (id) {
    await db.vehicle.updateMany({ where: { id, businessId: ctx.business.id }, data });
  } else {
    await db.vehicle.create({ data: { ...data, businessId: ctx.business.id } });
  }
  revalidatePath("/dashboard/customers");
  return { success: "Véhicule enregistré." };
}

/* ─────────── BOOKINGS ─────────── */

// Allowed status transitions — terminal states cannot be reopened.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [], cancelled: [], no_show: [],
};

export async function updateBookingStatus(formData: FormData) {
  const ctx = await requireBusiness();
  const status = bookingStatusSchema.parse(String(formData.get("status")));
  const id = String(formData.get("id"));

  const booking = await db.booking.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { service: true, customer: true },
  });
  if (!booking) return;
  if (!ALLOWED_TRANSITIONS[booking.status]?.includes(status)) return;

  const oldStatus = booking.status;
  await db.$transaction([
    db.booking.updateMany({ where: { id, businessId: ctx.business.id }, data: { status } }),
    db.bookingStatusHistory.create({
      data: {
        businessId: ctx.business.id, bookingId: id,
        oldStatus, newStatus: status, changedByProfileId: ctx.user.id,
      },
    }),
  ]);

  if (status === "cancelled" && booking.customer.email) {
    const settings = await db.businessSettings.findUnique({ where: { businessId: ctx.business.id } });
    const email = bookingCancelledEmail({
      businessName: ctx.business.name,
      customerName: booking.customer.fullName,
      serviceName: booking.service.name,
      startsAt: booking.startsAt.toISOString(),
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: booking.totalPriceCents,
      depositCents: booking.depositAmountCents,
    });
    await sendEmail({
      type: "booking_cancelled", to: booking.customer.email, ...email,
      businessId: ctx.business.id, bookingId: booking.id,
    });
  }
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${id}`);
}

/* ─────────── AVAILABILITY ─────────── */

export async function addAvailabilityRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = availabilityRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Horaire invalide." };
  if (parsed.data.start_time >= parsed.data.end_time) return { error: "L'heure de fin doit être après le début." };

  await db.availabilityRule.create({
    data: {
      businessId: ctx.business.id, weekday: parsed.data.weekday,
      startTime: parsed.data.start_time, endTime: parsed.data.end_time,
    },
  });
  revalidatePath("/dashboard/availability");
  return { success: "Créneau ajouté." };
}

export async function deleteAvailabilityRule(formData: FormData) {
  const ctx = await requireBusiness();
  await db.availabilityRule.deleteMany({
    where: { id: String(formData.get("id")), businessId: ctx.business.id },
  });
  revalidatePath("/dashboard/availability");
}

export async function addBlockedSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = blockedSlotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dates invalides." };
  const starts = new Date(parsed.data.starts_at);
  const ends = new Date(parsed.data.ends_at);
  if (!(starts < ends)) return { error: "La fin doit être après le début." };

  await db.blockedSlot.create({
    data: {
      businessId: ctx.business.id, startsAt: starts, endsAt: ends,
      reason: parsed.data.reason || null,
    },
  });
  revalidatePath("/dashboard/availability");
  return { success: "Période bloquée." };
}

export async function deleteBlockedSlot(formData: FormData) {
  const ctx = await requireBusiness();
  await db.blockedSlot.deleteMany({
    where: { id: String(formData.get("id")), businessId: ctx.business.id },
  });
  revalidatePath("/dashboard/availability");
}

/* ─────────── SETTINGS ─────────── */

export async function updateBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = businessSchema.omit({ slug: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.business.update({
    where: { id: ctx.business.id },
    data: {
      name: parsed.data.name, email: parsed.data.email,
      phone: parsed.data.phone || null, address: parsed.data.address || null,
      businessType: parsed.data.business_type, logoUrl: parsed.data.logo_url || null,
      cancellationPolicy: parsed.data.cancellation_policy || null,
    },
  });
  revalidatePath("/dashboard/settings");
  return { success: "Business mis à jour." };
}

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.businessSettings.upsert({
    where: { businessId: ctx.business.id },
    create: {
      businessId: ctx.business.id, timezone: parsed.data.timezone,
      reminderHoursBefore: parsed.data.reminder_hours_before,
      bookingNoticeHours: parsed.data.booking_notice_hours,
      bufferMinutes: parsed.data.buffer_minutes,
      confirmationMessage: parsed.data.confirmation_message || null,
      reminderMessage: parsed.data.reminder_message || null,
      googleReviewUrl: parsed.data.google_review_url || null,
    },
    update: {
      timezone: parsed.data.timezone,
      reminderHoursBefore: parsed.data.reminder_hours_before,
      bookingNoticeHours: parsed.data.booking_notice_hours,
      bufferMinutes: parsed.data.buffer_minutes,
      confirmationMessage: parsed.data.confirmation_message || null,
      reminderMessage: parsed.data.reminder_message || null,
      googleReviewUrl: parsed.data.google_review_url || null,
    },
  });
  revalidatePath("/dashboard/settings");
  return { success: "Réglages enregistrés." };
}

/* ─────────── ADD-ONS ─────────── */

export async function upsertAddon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = addonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // the addon's service must belong to this business
  const service = await db.service.findFirst({
    where: { id: parsed.data.service_id, businessId: ctx.business.id },
  });
  if (!service) return { error: "Service introuvable." };

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const data = {
    name: parsed.data.name,
    priceCents: Math.round(parsed.data.price_euros * 100),
  };
  if (id) {
    await db.serviceAddon.updateMany({ where: { id, businessId: ctx.business.id }, data });
  } else {
    await db.serviceAddon.create({
      data: { ...data, businessId: ctx.business.id, serviceId: service.id },
    });
  }
  revalidatePath("/dashboard/services");
  return { success: "Option enregistrée." };
}

export async function deleteAddon(formData: FormData) {
  const ctx = await requireBusiness();
  await db.serviceAddon.updateMany({
    where: { id: String(formData.get("id")), businessId: ctx.business.id },
    data: { isActive: false },
  });
  revalidatePath("/dashboard/services");
}

/* ─────────── PHOTOS AVANT/APRÈS ─────────── */

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export async function uploadBookingPhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const bookingId = String(formData.get("booking_id"));
  const kind = String(formData.get("kind")) === "after" ? "after" as const : "before" as const;
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) return { error: "Choisis une photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo trop lourde (max 2 Mo)." };
  if (!ALLOWED_MIME.includes(file.type)) return { error: "Format non supporté (JPEG, PNG ou WebP)." };

  const booking = await db.booking.findFirst({
    where: { id: bookingId, businessId: ctx.business.id }, select: { id: true },
  });
  if (!booking) return { error: "Réservation introuvable." };

  const count = await db.bookingPhoto.count({ where: { bookingId, businessId: ctx.business.id } });
  if (count >= 12) return { error: "Maximum 12 photos par réservation." };

  const bytes = Buffer.from(await file.arrayBuffer());
  await db.bookingPhoto.create({
    data: { businessId: ctx.business.id, bookingId, kind, mime: file.type, data: bytes },
  });
  revalidatePath(`/dashboard/bookings/${bookingId}`);
  return { success: "Photo ajoutée." };
}

export async function deleteBookingPhoto(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  const photo = await db.bookingPhoto.findFirst({
    where: { id, businessId: ctx.business.id }, select: { bookingId: true },
  });
  if (!photo) return;
  await db.bookingPhoto.deleteMany({ where: { id, businessId: ctx.business.id } });
  revalidatePath(`/dashboard/bookings/${photo.bookingId}`);
}

/* ─────────── STRIPE CONNECT ─────────── */

export async function connectStripe() {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner") return;

  let accountId = ctx.business.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: ctx.business.email,
      business_profile: { name: ctx.business.name },
      metadata: { business_id: ctx.business.id },
    });
    accountId = account.id;
    await db.business.update({ where: { id: ctx.business.id }, data: { stripeAccountId: accountId } });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: appUrl("/dashboard/settings?stripe=refresh"),
    return_url: appUrl("/dashboard/settings?stripe=return"),
    type: "account_onboarding",
  });
  redirect(link.url);
}

/** Re-checks the connected account status (called on return from Stripe onboarding). */
export async function refreshStripeStatus() {
  const ctx = await requireBusiness();
  if (!ctx.business.stripe_account_id) return;
  const account = await stripe.accounts.retrieve(ctx.business.stripe_account_id);
  const connected = Boolean(account.charges_enabled);
  await db.business.update({ where: { id: ctx.business.id }, data: { stripeConnected: connected } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
