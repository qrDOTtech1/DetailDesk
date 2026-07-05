"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { stripe, appUrl } from "@/lib/stripe";
import { sendEmail } from "@/lib/mailer";
import { bookingCancelledEmail } from "@/lib/emails";
import {
  serviceSchema, customerSchema, vehicleSchema, availabilityRuleSchema,
  blockedSlotSchema, settingsSchema, businessSchema, bookingStatusSchema,
} from "@/lib/validators";
import { redirect } from "next/navigation";

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

  const supabase = await createClient();
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const row = { ...parsed.data, description: parsed.data.description || null, business_id: ctx.business.id };

  const { error } = id
    ? await supabase.from("services").update(row).eq("id", id).eq("business_id", ctx.business.id)
    : await supabase.from("services").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/services");
  return { success: "Service enregistré." };
}

export async function deleteService(formData: FormData) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  await supabase.from("services")
    .update({ is_active: false })
    .eq("id", String(formData.get("id"))).eq("business_id", ctx.business.id);
  revalidatePath("/dashboard/services");
}

/* ─────────── CUSTOMERS ─────────── */

export async function upsertCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const row = {
    full_name: parsed.data.full_name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
    business_id: ctx.business.id,
  };
  const { error } = id
    ? await supabase.from("customers").update(row).eq("id", id).eq("business_id", ctx.business.id)
    : await supabase.from("customers").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/customers");
  return { success: "Client enregistré." };
}

/* ─────────── VEHICLES ─────────── */

export async function upsertVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // customer must belong to this business (RLS also enforces it)
  const { data: cust } = await supabase.from("customers")
    .select("id").eq("id", parsed.data.customer_id).eq("business_id", ctx.business.id).maybeSingle();
  if (!cust) return { error: "Client introuvable." };

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const row = {
    business_id: ctx.business.id,
    customer_id: parsed.data.customer_id,
    make: parsed.data.make,
    model: parsed.data.model,
    year: parsed.data.year || null,
    plate: parsed.data.plate || null,
    size_category: parsed.data.size_category ?? "other",
    notes: parsed.data.notes || null,
  };
  const { error } = id
    ? await supabase.from("vehicles").update(row).eq("id", id).eq("business_id", ctx.business.id)
    : await supabase.from("vehicles").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/customers");
  return { success: "Véhicule enregistré." };
}

/* ─────────── BOOKINGS ─────────── */

export async function updateBookingStatus(formData: FormData) {
  const ctx = await requireBusiness();
  const status = bookingStatusSchema.parse(String(formData.get("status")));
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: booking } = await supabase.from("bookings")
    .select("*, services(name), customers(full_name, email)")
    .eq("id", id).eq("business_id", ctx.business.id).single();
  if (!booking) return;

  await supabase.from("bookings").update({ status }).eq("id", id).eq("business_id", ctx.business.id);

  if (status === "cancelled" && booking.customers?.email) {
    const { data: settings } = await supabase.from("business_settings")
      .select("timezone").eq("business_id", ctx.business.id).single();
    const email = bookingCancelledEmail({
      businessName: ctx.business.name,
      customerName: booking.customers.full_name,
      serviceName: booking.services?.name ?? "Service",
      startsAt: booking.starts_at,
      timezone: settings?.timezone ?? "Europe/Paris",
      totalCents: booking.total_price_cents,
      depositCents: booking.deposit_amount_cents,
    });
    await sendEmail({
      type: "booking_cancelled", to: booking.customers.email, ...email,
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

  const supabase = await createClient();
  const { error } = await supabase.from("availability_rules")
    .insert({ ...parsed.data, business_id: ctx.business.id });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/availability");
  return { success: "Créneau ajouté." };
}

export async function deleteAvailabilityRule(formData: FormData) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  await supabase.from("availability_rules")
    .delete().eq("id", String(formData.get("id"))).eq("business_id", ctx.business.id);
  revalidatePath("/dashboard/availability");
}

export async function addBlockedSlot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = blockedSlotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Dates invalides." };
  const starts = new Date(parsed.data.starts_at);
  const ends = new Date(parsed.data.ends_at);
  if (!(starts < ends)) return { error: "La fin doit être après le début." };

  const supabase = await createClient();
  const { error } = await supabase.from("blocked_slots").insert({
    business_id: ctx.business.id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reason: parsed.data.reason || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/availability");
  return { success: "Période bloquée." };
}

export async function deleteBlockedSlot(formData: FormData) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  await supabase.from("blocked_slots")
    .delete().eq("id", String(formData.get("id"))).eq("business_id", ctx.business.id);
  revalidatePath("/dashboard/availability");
}

/* ─────────── SETTINGS ─────────── */

export async function updateBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = businessSchema.omit({ slug: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").update({
    name: parsed.data.name, email: parsed.data.email,
    phone: parsed.data.phone || null, address: parsed.data.address || null,
    business_type: parsed.data.business_type, logo_url: parsed.data.logo_url || null,
    cancellation_policy: parsed.data.cancellation_policy || null,
  }).eq("id", ctx.business.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: "Business mis à jour." };
}

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("business_settings").upsert({
    business_id: ctx.business.id,
    ...parsed.data,
    confirmation_message: parsed.data.confirmation_message || null,
    reminder_message: parsed.data.reminder_message || null,
  }, { onConflict: "business_id" });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: "Réglages enregistrés." };
}

/* ─────────── STRIPE CONNECT ─────────── */

export async function connectStripe() {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner") return;
  const supabase = await createClient();

  let accountId = ctx.business.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: ctx.business.email,
      business_profile: { name: ctx.business.name },
      metadata: { business_id: ctx.business.id },
    });
    accountId = account.id;
    await supabase.from("businesses")
      .update({ stripe_account_id: accountId }).eq("id", ctx.business.id);
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
  const supabase = await createClient();
  await supabase.from("businesses")
    .update({ stripe_connected: connected }).eq("id", ctx.business.id);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
