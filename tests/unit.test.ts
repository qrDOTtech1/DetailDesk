import { describe, it, expect } from "vitest";
import { computeSlots, zonedToUtc } from "@/lib/slots";
import { computeDeposit, slugify } from "@/lib/utils";
import { serviceSchema, promotionSchema, publicBookingSchema } from "@/lib/validators";

// normalizePhone lives in sms.ts which imports the Prisma client (heavy in
// unit tests) — re-tested here through a local copy of the same contract.
import { normalizePhone } from "@/lib/sms";

describe("computeDeposit", () => {
  it("returns 0 when deposit not required", () => {
    expect(computeDeposit({ deposit_required: false, deposit_type: "fixed", deposit_value: 2000, price_cents: 8900 })).toBe(0);
  });
  it("fixed deposit returns the value", () => {
    expect(computeDeposit({ deposit_required: true, deposit_type: "fixed", deposit_value: 2000, price_cents: 8900 })).toBe(2000);
  });
  it("percent deposit rounds correctly", () => {
    expect(computeDeposit({ deposit_required: true, deposit_type: "percent", deposit_value: 30, price_cents: 49900 })).toBe(14970);
    expect(computeDeposit({ deposit_required: true, deposit_type: "percent", deposit_value: 33, price_cents: 100 })).toBe(33);
  });
});

describe("slugify", () => {
  it("normalizes accents and spaces", () => {
    expect(slugify("Shine Détailing Pro !")).toBe("shine-detailing-pro");
  });
});

describe("zonedToUtc", () => {
  it("converts Paris winter time (UTC+1)", () => {
    expect(zonedToUtc("2026-01-15", "10:00", "Europe/Paris").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });
  it("converts Paris summer time (UTC+2, DST)", () => {
    expect(zonedToUtc("2026-07-15", "10:00", "Europe/Paris").toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });
});

describe("computeSlots", () => {
  const base = {
    timezone: "Europe/Paris",
    durationMinutes: 60,
    bufferMinutes: 0,
    noticeHours: 0,
    rules: [{ weekday: 3, start_time: "09:00", end_time: "12:00" }], // Wednesday
    busy: [],
  };
  // far future Wednesday so noticeHours never interferes
  const wednesday = "2030-01-02";

  it("generates slots inside opening hours", () => {
    const slots = computeSlots({ ...base, date: wednesday });
    // 09:00..11:00 start times with 60min duration, 30min step → 5 slots
    expect(slots.length).toBe(5);
    expect(slots[0].toISOString()).toBe(zonedToUtc(wednesday, "09:00", "Europe/Paris").toISOString());
  });

  it("returns nothing on a closed day", () => {
    expect(computeSlots({ ...base, date: "2030-01-03" })).toEqual([]); // Thursday
  });

  it("excludes slots overlapping busy intervals", () => {
    const busyStart = zonedToUtc(wednesday, "10:00", "Europe/Paris");
    const busyEnd = zonedToUtc(wednesday, "11:00", "Europe/Paris");
    const slots = computeSlots({ ...base, date: wednesday, busy: [{ start: busyStart, end: busyEnd }] });
    const times = slots.map((s) => s.toISOString());
    expect(times).not.toContain(zonedToUtc(wednesday, "10:00", "Europe/Paris").toISOString());
    expect(times).not.toContain(zonedToUtc(wednesday, "10:30", "Europe/Paris").toISOString());
    expect(times).toContain(zonedToUtc(wednesday, "09:00", "Europe/Paris").toISOString());
    expect(times).toContain(zonedToUtc(wednesday, "11:00", "Europe/Paris").toISOString());
  });

  it("respects the buffer between bookings", () => {
    const busyStart = zonedToUtc(wednesday, "10:00", "Europe/Paris");
    const busyEnd = zonedToUtc(wednesday, "11:00", "Europe/Paris");
    const slots = computeSlots({
      ...base, date: wednesday, bufferMinutes: 30,
      busy: [{ start: busyStart, end: busyEnd }],
    });
    // 09:00 + 60min + 30min buffer = ends 10:30 → overlaps busy 10:00 → excluded
    const times = slots.map((s) => s.toISOString());
    expect(times).not.toContain(zonedToUtc(wednesday, "09:00", "Europe/Paris").toISOString());
  });

  it("respects the notice period", () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    const slots = computeSlots({
      ...base,
      rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start_time: "00:00", end_time: "23:59" })),
      date: today, noticeHours: 48,
    });
    expect(slots).toEqual([]); // everything today is within 48h notice
  });
});

describe("normalizePhone", () => {
  it("converts FR numbers to E.164", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("0612345678")).toBe("+33612345678");
    expect(normalizePhone("+33612345678")).toBe("+33612345678");
  });
  it("rejects garbage", () => {
    expect(normalizePhone("hello")).toBeNull();
    expect(normalizePhone("12")).toBeNull();
  });
});

describe("validators", () => {
  it("serviceSchema converts euros and rejects >100% deposits", () => {
    const ok = serviceSchema.safeParse({
      name: "Intérieur", category: "interior", price_euros: "89",
      duration_minutes: "120", deposit_required: true,
      deposit_type: "percent", deposit_value: "30", rebook_after_days: "60", is_active: true,
    });
    expect(ok.success).toBe(true);
    const bad = serviceSchema.safeParse({
      name: "X2", category: "other", price_euros: "10", duration_minutes: "60",
      deposit_required: true, deposit_type: "percent", deposit_value: "150",
      rebook_after_days: "0", is_active: true,
    });
    expect(bad.success).toBe(false);
  });

  it("promotionSchema enforces code format", () => {
    expect(promotionSchema.safeParse({
      code: "BIENVENUE10", discount_type: "percent", discount_value: "10", usage_limit: "0",
    }).success).toBe(true);
    expect(promotionSchema.safeParse({
      code: "hé hé!", discount_type: "percent", discount_value: "10", usage_limit: "0",
    }).success).toBe(false);
  });

  it("publicBookingSchema rejects forged payloads", () => {
    expect(publicBookingSchema.safeParse({
      service_id: "not-a-uuid", starts_at: "2030-01-01T10:00:00Z",
      customer_name: "K", customer_email: "bad",
      vehicle_make: "", vehicle_model: "",
    }).success).toBe(false);
  });
});
