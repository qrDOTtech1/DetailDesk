"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, appUrl } from "@/lib/stripe";
import { z } from "zod";
import { sendEmail } from "@/lib/mailer";
import { bookingCancelledEmail, bookingConfirmationEmail } from "@/lib/emails";
import {
  serviceSchema, customerSchema, vehicleSchema, availabilityRuleSchema,
  blockedSlotSchema, settingsSchema, businessSchema, bookingStatusSchema, addonSchema,
  promotionSchema,
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
    trim: parsed.data.trim || null,
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

/* ─────────── MANUAL BOOKING + RESCHEDULE ─────────── */

const manualBookingSchema = z.object({
  service_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().or(z.literal("")),
  customer_name: z.string().max(100).optional().or(z.literal("")),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_phone: z.string().max(30).optional().or(z.literal("")),
  starts_at: z.string().min(1, "Choisis une date"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function createManualBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = manualBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const service = await db.service.findFirst({
    where: { id: d.service_id, businessId: ctx.business.id },
  });
  if (!service) return { error: "Service introuvable." };

  const starts = new Date(d.starts_at);
  if (isNaN(starts.getTime())) return { error: "Date invalide." };
  const ends = new Date(starts.getTime() + service.durationMinutes * 60_000);

  // resolve customer: existing (scoped) or create from the free fields
  let customerId: string;
  if (d.customer_id) {
    const existing = await db.customer.findFirst({
      where: { id: d.customer_id, businessId: ctx.business.id },
    });
    if (!existing) return { error: "Client introuvable." };
    customerId = existing.id;
  } else {
    if (!d.customer_name) return { error: "Indique le nom du client." };
    const email = d.customer_email?.toLowerCase() || null;
    const match = email
      ? await db.customer.findFirst({ where: { businessId: ctx.business.id, email } })
      : null;
    customerId = match?.id ?? (await db.customer.create({
      data: {
        businessId: ctx.business.id, fullName: d.customer_name,
        email, phone: d.customer_phone || null,
      },
    })).id;
  }

  try {
    const booking = await db.$transaction(async (tx) => {
      const clash = await tx.booking.count({
        where: {
          businessId: ctx.business.id, status: { in: ["pending", "confirmed"] },
          startsAt: { lt: ends }, endsAt: { gt: starts },
        },
      });
      if (clash > 0) throw new Error("SLOT_TAKEN");
      const created = await tx.booking.create({
        data: {
          businessId: ctx.business.id, serviceId: service.id, customerId,
          status: "confirmed", startsAt: starts, endsAt: ends,
          totalPriceCents: service.priceCents, notes: d.notes || null,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          businessId: ctx.business.id, bookingId: created.id,
          oldStatus: null, newStatus: "confirmed", changedByProfileId: ctx.user.id,
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    revalidatePath("/dashboard/bookings");
    redirect(`/dashboard/bookings/${booking.id}`);
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return { error: "Ce créneau chevauche une réservation existante." };
    }
    throw e; // redirect() throws — let it through
  }
}

export async function rescheduleBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  const startsRaw = String(formData.get("starts_at") ?? "");
  const starts = new Date(startsRaw);
  if (isNaN(starts.getTime())) return { error: "Date invalide." };

  const booking = await db.booking.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { service: true, customer: true },
  });
  if (!booking) return { error: "Réservation introuvable." };
  if (!["pending", "confirmed"].includes(booking.status)) {
    return { error: "Impossible de déplacer une réservation terminée ou annulée." };
  }

  const ends = new Date(starts.getTime() + booking.service.durationMinutes * 60_000);
  const clash = await db.booking.count({
    where: {
      businessId: ctx.business.id, id: { not: id },
      status: { in: ["pending", "confirmed"] },
      startsAt: { lt: ends }, endsAt: { gt: starts },
    },
  });
  if (clash > 0) return { error: "Ce créneau chevauche une autre réservation." };

  await db.booking.update({ where: { id }, data: { startsAt: starts, endsAt: ends } });

  // tell the customer about the new date
  if (booking.customer.email) {
    const settings = await db.businessSettings.findUnique({ where: { businessId: ctx.business.id } });
    const email = bookingConfirmationEmail({
      businessName: ctx.business.name, customerName: booking.customer.fullName,
      serviceName: booking.service.name, startsAt: starts.toISOString(),
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: booking.totalPriceCents, depositCents: booking.depositAmountCents,
      cancelUrl: appUrl(`/cancel/${booking.publicCancelToken}`),
    });
    await sendEmail({
      type: "booking_confirmation", to: booking.customer.email,
      subject: `Rendez-vous déplacé — ${ctx.business.name}`, html: email.html,
      businessId: ctx.business.id, bookingId: booking.id,
    });
  }

  revalidatePath(`/dashboard/bookings/${id}`);
  revalidatePath("/dashboard/bookings");
  return { success: "Réservation déplacée, client prévenu par email." };
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
  const raw = Object.fromEntries(formData);
  const parsed = settingsSchema.safeParse({
    ...raw,
    show_public_gallery: raw.show_public_gallery === "on" || raw.show_public_gallery === "true",
  });
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
      showPublicGallery: parsed.data.show_public_gallery,
    },
    update: {
      timezone: parsed.data.timezone,
      reminderHoursBefore: parsed.data.reminder_hours_before,
      bookingNoticeHours: parsed.data.booking_notice_hours,
      bufferMinutes: parsed.data.buffer_minutes,
      confirmationMessage: parsed.data.confirmation_message || null,
      reminderMessage: parsed.data.reminder_message || null,
      googleReviewUrl: parsed.data.google_review_url || null,
      showPublicGallery: parsed.data.show_public_gallery,
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
  const kindRaw = String(formData.get("kind"));
  const kind = kindRaw === "after" ? "after" as const : kindRaw === "general" ? "general" as const : "before" as const;
  const caption = String(formData.get("caption") ?? "").slice(0, 120) || null;
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) return { error: "Choisis une photo." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo trop lourde (max 2 Mo)." };
  if (!ALLOWED_MIME.includes(file.type)) return { error: "Format non supporté (JPEG, PNG ou WebP)." };

  const booking = await db.booking.findFirst({
    where: { id: bookingId, businessId: ctx.business.id },
    select: { id: true, customerId: true, vehicleId: true },
  });
  if (!booking) return { error: "Réservation introuvable." };

  const count = await db.bookingPhoto.count({ where: { bookingId, businessId: ctx.business.id } });
  if (count >= 12) return { error: "Maximum 12 photos par réservation." };

  const bytes = Buffer.from(await file.arrayBuffer());
  await db.bookingPhoto.create({
    data: {
      businessId: ctx.business.id, bookingId, kind, caption,
      customerId: booking.customerId, vehicleId: booking.vehicleId,
      mime: file.type, data: bytes,
    },
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

/* ─────────── PHOTO SHARING ─────────── */

/** Marks a photo shareable + publicly visible (still gated by customer consent). */
export async function togglePhotoShare(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  const photo = await db.bookingPhoto.findFirst({
    where: { id, businessId: ctx.business.id }, select: { isShareable: true, bookingId: true },
  });
  if (!photo) return;
  const share = !photo.isShareable;
  await db.bookingPhoto.updateMany({
    where: { id, businessId: ctx.business.id },
    data: { isShareable: share, isPublicVisible: share },
  });
  if (photo.bookingId) revalidatePath(`/dashboard/bookings/${photo.bookingId}`);
  revalidatePath("/dashboard/customers");
}

/* ─────────── CUSTOMER: VIP + CONSENT ─────────── */

export async function toggleCustomerVip(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  const customer = await db.customer.findFirst({
    where: { id, businessId: ctx.business.id }, select: { isVip: true },
  });
  if (!customer) return;
  await db.customer.updateMany({
    where: { id, businessId: ctx.business.id }, data: { isVip: !customer.isVip },
  });
  revalidatePath(`/dashboard/customers/${id}`);
}

/** Pro records a consent given verbally / in person. */
export async function setCustomerConsent(formData: FormData) {
  const ctx = await requireBusiness();
  const customerId = String(formData.get("customer_id"));
  const granted = String(formData.get("granted")) === "true";

  const customer = await db.customer.findFirst({
    where: { id: customerId, businessId: ctx.business.id }, select: { id: true },
  });
  if (!customer) return;

  await db.customerConsent.upsert({
    where: { customerId_consentType: { customerId, consentType: "public_photos" } },
    create: {
      businessId: ctx.business.id, customerId, consentType: "public_photos",
      granted, grantedAt: granted ? new Date() : null,
      revokedAt: granted ? null : new Date(), source: "pro_dashboard",
    },
    update: {
      granted, grantedAt: granted ? new Date() : undefined,
      revokedAt: granted ? null : new Date(), source: "pro_dashboard",
    },
  });
  revalidatePath(`/dashboard/customers/${customerId}`);
}

/* ─────────── PROMOTIONS ─────────── */

export async function upsertPromotion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = promotionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const code = d.code.toUpperCase();
  const existing = await db.promotion.findUnique({
    where: { businessId_code: { businessId: ctx.business.id, code } },
  });
  if (existing) return { error: "Ce code existe déjà." };

  await db.promotion.create({
    data: {
      businessId: ctx.business.id, code,
      label: d.label || null,
      discountType: d.discount_type,
      discountValue: d.discount_type === "fixed" ? Math.round(d.discount_value * 100) : Math.round(d.discount_value),
      endsAt: d.ends_at ? new Date(d.ends_at) : null,
      usageLimit: d.usage_limit > 0 ? d.usage_limit : null,
    },
  });
  revalidatePath("/dashboard/settings");
  return { success: "Promo créée." };
}

export async function togglePromotion(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  const promo = await db.promotion.findFirst({
    where: { id, businessId: ctx.business.id }, select: { isActive: true },
  });
  if (!promo) return;
  await db.promotion.updateMany({
    where: { id, businessId: ctx.business.id }, data: { isActive: !promo.isActive },
  });
  revalidatePath("/dashboard/settings");
}

/* ─────────── SMS ─────────── */

export async function toggleSmsReminders() {
  const ctx = await requireBusiness();
  const settings = await db.businessSettings.findUnique({ where: { businessId: ctx.business.id } });
  await db.businessSettings.upsert({
    where: { businessId: ctx.business.id },
    create: { businessId: ctx.business.id, smsRemindersEnabled: true },
    update: { smsRemindersEnabled: !settings?.smsRemindersEnabled },
  });
  revalidatePath("/dashboard/settings");
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

/* ─────────── SUBSCRIPTION (platform billing, 29€/mois) ─────────── */

/** Starts the DetailDesk Pro subscription via Stripe Checkout (14-day trial). */
export async function startSubscription() {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner") return;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID is not set");

  const business = await db.business.findUnique({ where: { id: ctx.business.id } });
  let customerId = business?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ctx.business.email, name: ctx.business.name,
      metadata: { business_id: ctx.business.id },
    });
    customerId = customer.id;
    await db.business.update({ where: { id: ctx.business.id }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { business_id: ctx.business.id },
    },
    success_url: appUrl("/dashboard/settings?billing=success"),
    cancel_url: appUrl("/dashboard/settings?billing=cancel"),
  });
  redirect(session.url!);
}

/** Opens the Stripe customer portal (invoices, card, cancel). */
export async function openBillingPortal() {
  const ctx = await requireBusiness();
  const business = await db.business.findUnique({ where: { id: ctx.business.id } });
  if (!business?.stripeCustomerId) return;
  const session = await stripe.billingPortal.sessions.create({
    customer: business.stripeCustomerId,
    return_url: appUrl("/dashboard/settings"),
  });
  redirect(session.url);
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
