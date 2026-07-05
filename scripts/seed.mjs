/**
 * DetailDesk demo seed.
 * Usage:  node scripts/seed.mjs
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (or env).
 *
 * Creates: platform admin, demo owner, demo business, services, customers,
 * vehicles, bookings, payments.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// tiny .env loader (no extra dependency)
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const ADMIN_EMAIL = "admin@detaildesk.demo";
const OWNER_EMAIL = "owner@detaildesk.demo";
const PASSWORD = "detaildesk-demo-2026";

async function ensureUser(email, fullName) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log("→ users");
  const adminId = await ensureUser(ADMIN_EMAIL, "Platform Admin");
  const ownerId = await ensureUser(OWNER_EMAIL, "Demo Owner");

  await supabase.from("profiles").upsert([
    { id: adminId, email: ADMIN_EMAIL, full_name: "Platform Admin", platform_role: "platform_admin" },
    { id: ownerId, email: OWNER_EMAIL, full_name: "Demo Owner" },
  ]);

  console.log("→ business");
  const { data: existingBiz } = await supabase.from("businesses").select("id").eq("slug", "shine-demo").maybeSingle();
  let bizId = existingBiz?.id;
  if (!bizId) {
    const { data: biz, error } = await supabase.from("businesses").insert({
      name: "Shine Detailing (démo)", slug: "shine-demo",
      email: OWNER_EMAIL, phone: "06 12 34 56 78",
      address: "12 rue du Detailing, 75000 Paris", business_type: "both",
      cancellation_policy: "Annulation gratuite jusqu'à 24h avant le rendez-vous.",
      is_test: true,
    }).select("id").single();
    if (error) throw error;
    bizId = biz.id;
    await supabase.from("business_members").insert({ business_id: bizId, user_id: ownerId, role: "owner" });
    await supabase.from("business_settings").insert({ business_id: bizId });
    await supabase.from("availability_rules").insert(
      [1, 2, 3, 4, 5, 6].map((weekday) => ({ business_id: bizId, weekday, start_time: "09:00", end_time: "18:00" }))
    );
  }

  console.log("→ services");
  const { data: existingSvcs } = await supabase.from("services").select("id").eq("business_id", bizId);
  let services = existingSvcs ?? [];
  if (services.length === 0) {
    const { data } = await supabase.from("services").insert([
      { business_id: bizId, name: "Intérieur complet", category: "interior", price_cents: 8900, duration_minutes: 120, deposit_required: true, deposit_type: "fixed", deposit_value: 2000 },
      { business_id: bizId, name: "Lavage extérieur premium", category: "exterior", price_cents: 4900, duration_minutes: 60, deposit_required: false, deposit_type: "fixed", deposit_value: 0 },
      { business_id: bizId, name: "Traitement céramique", category: "ceramic", price_cents: 49900, duration_minutes: 480, deposit_required: true, deposit_type: "percent", deposit_value: 30 },
    ]).select("id, price_cents");
    services = data ?? [];
  }

  console.log("→ customers + vehicles");
  const { data: existingCust } = await supabase.from("customers").select("id").eq("business_id", bizId);
  let customers = existingCust ?? [];
  if (customers.length === 0) {
    const { data } = await supabase.from("customers").insert([
      { business_id: bizId, full_name: "Karim Benali", email: "karim@example.com", phone: "06 11 22 33 44" },
      { business_id: bizId, full_name: "Julie Martin", email: "julie@example.com", phone: "06 55 66 77 88" },
      { business_id: bizId, full_name: "Marc Dupont", email: "marc@example.com", notes: "Client fidèle, 3 voitures." },
    ]).select("id");
    customers = data ?? [];
    await supabase.from("vehicles").insert([
      { business_id: bizId, customer_id: customers[0].id, make: "Mercedes", model: "C220 CDI", year: 2010, size_category: "sedan" },
      { business_id: bizId, customer_id: customers[1].id, make: "Peugeot", model: "208", year: 2021, size_category: "compact" },
      { business_id: bizId, customer_id: customers[2].id, make: "Audi", model: "Q5", year: 2019, size_category: "suv" },
    ]);
  }

  console.log("→ bookings + payments");
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", bizId);
  if ((count ?? 0) === 0) {
    const { data: vehicles } = await supabase.from("vehicles").select("id, customer_id").eq("business_id", bizId);
    const vFor = (cid) => vehicles?.find((v) => v.customer_id === cid)?.id ?? null;
    const day = (offset, hour) => {
      const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d.toISOString();
    };
    const rows = [
      { c: 0, s: 0, start: day(2, 10), dur: 120, status: "confirmed", depPaid: true },
      { c: 1, s: 1, start: day(3, 14), dur: 60, status: "pending", depPaid: false },
      { c: 2, s: 2, start: day(7, 9), dur: 480, status: "confirmed", depPaid: true },
      { c: 0, s: 1, start: day(-7, 11), dur: 60, status: "completed", depPaid: false },
      { c: 1, s: 0, start: day(-3, 15), dur: 120, status: "no_show", depPaid: false },
    ];
    for (const r of rows) {
      const svc = services[r.s];
      const deposit = r.s === 0 ? 2000 : r.s === 2 ? Math.round(svc.price_cents * 0.3) : 0;
      const { data: booking } = await supabase.from("bookings").insert({
        business_id: bizId, service_id: svc.id, customer_id: customers[r.c].id,
        vehicle_id: vFor(customers[r.c].id), status: r.status,
        starts_at: r.start, ends_at: new Date(new Date(r.start).getTime() + r.dur * 60000).toISOString(),
        total_price_cents: svc.price_cents, deposit_amount_cents: deposit, deposit_paid: r.depPaid,
      }).select("id").single();
      if (r.depPaid && deposit > 0 && booking) {
        await supabase.from("payments").insert({
          business_id: bizId, booking_id: booking.id, amount_cents: deposit,
          currency: "eur", status: "succeeded", provider: "stripe",
          stripe_payment_intent_id: `pi_demo_${booking.id.slice(0, 8)}`,
        });
      }
    }
  }

  console.log(`
✔ Seed terminé.
  Platform admin : ${ADMIN_EMAIL} / ${PASSWORD}
  Owner démo     : ${OWNER_EMAIL} / ${PASSWORD}
  Page publique  : /b/shine-demo
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
