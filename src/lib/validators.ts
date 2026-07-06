import { z } from "zod";

export const businessSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug invalide (minuscules, chiffres, tirets)"),
  email: z.string().email(),
  phone: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  business_type: z.enum(["studio", "mobile", "both"]),
  logo_url: z.string().url().optional().or(z.literal("")),
  cancellation_policy: z.string().max(1000).optional().or(z.literal("")),
});

export const serviceSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(100),
  description: z.string().max(1000).optional().or(z.literal("")),
  category: z.enum(["interior", "exterior", "polish", "ceramic", "restoration", "other"]),
  // prices are entered in EUROS in the UI, converted to cents server-side
  price_euros: z.coerce.number().min(0, "Prix invalide").max(100_000),
  duration_minutes: z.coerce.number().int().min(15).max(1440),
  deposit_required: z.coerce.boolean(),
  deposit_type: z.enum(["fixed", "percent"]),
  deposit_value: z.coerce.number().min(0).max(100_000), // euros (fixed) or % (percent)
  is_active: z.coerce.boolean(),
}).refine((s) => s.deposit_type !== "percent" || s.deposit_value <= 100, {
  message: "Un acompte en % ne peut pas dépasser 100",
  path: ["deposit_value"],
});

export const customerSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const vehicleSchema = z.object({
  customer_id: z.string().uuid(),
  make: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.coerce.number().int().min(1950).max(2035).optional().or(z.literal("")),
  plate: z.string().max(20).optional().or(z.literal("")),
  size_category: z.enum(["compact", "sedan", "suv", "truck", "van", "other"]).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const availabilityRuleSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const blockedSlotSchema = z.object({
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  reason: z.string().max(200).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  timezone: z.string().min(1).max(60),
  reminder_hours_before: z.coerce.number().int().min(1).max(168),
  booking_notice_hours: z.coerce.number().int().min(0).max(720),
  buffer_minutes: z.coerce.number().int().min(0).max(240),
  confirmation_message: z.string().max(1000).optional().or(z.literal("")),
  reminder_message: z.string().max(1000).optional().or(z.literal("")),
});

export const publicBookingSchema = z.object({
  service_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  customer_name: z.string().min(2).max(100),
  customer_email: z.string().email(),
  customer_phone: z.string().max(30).optional().or(z.literal("")),
  vehicle_make: z.string().min(1).max(50),
  vehicle_model: z.string().min(1).max(50),
  vehicle_year: z.coerce.number().int().min(1950).max(2035).optional().or(z.literal("")),
  vehicle_size: z.enum(["compact", "sedan", "suv", "truck", "van", "other"]).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const bookingStatusSchema = z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]);
