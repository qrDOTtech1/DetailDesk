/**
 * DetailDesk demo seed.
 * Usage:  npm run db:seed
 * Needs DATABASE_URL (Railway Postgres) in .env.
 *
 * Creates: platform admin, demo owner, demo business, services, customers,
 * vehicles, bookings, payments.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const ADMIN_EMAIL = "admin@detaildesk.demo";
const OWNER_EMAIL = "owner@detaildesk.demo";
const PASSWORD = "detaildesk-demo-2026";

async function ensureProfile(email, fullName, platformRole) {
  const existing = await db.profile.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return db.profile.create({ data: { email, passwordHash, fullName, platformRole: platformRole ?? null } });
}

async function main() {
  console.log("→ users");
  await ensureProfile(ADMIN_EMAIL, "Platform Admin", "platform_admin");
  const owner = await ensureProfile(OWNER_EMAIL, "Demo Owner");

  console.log("→ business");
  let business = await db.business.findUnique({ where: { slug: "shine-demo" } });
  if (!business) {
    business = await db.business.create({
      data: {
        name: "Shine Detailing (démo)", slug: "shine-demo",
        email: OWNER_EMAIL, phone: "06 12 34 56 78",
        address: "12 rue du Detailing, 75000 Paris", businessType: "both",
        cancellationPolicy: "Annulation gratuite jusqu'à 24h avant le rendez-vous.",
        isTest: true,
      },
    });
    await db.businessMember.create({ data: { businessId: business.id, userId: owner.id, role: "owner" } });
    await db.businessSettings.create({ data: { businessId: business.id } });
    await db.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5, 6].map((weekday) => ({ businessId: business.id, weekday, startTime: "09:00", endTime: "18:00" })),
    });
  }

  console.log("→ services");
  let services = await db.service.findMany({ where: { businessId: business.id } });
  if (services.length === 0) {
    await db.service.createMany({
      data: [
        { businessId: business.id, name: "Intérieur complet", category: "interior", priceCents: 8900, durationMinutes: 120, depositRequired: true, depositType: "fixed", depositValue: 2000 },
        { businessId: business.id, name: "Lavage extérieur premium", category: "exterior", priceCents: 4900, durationMinutes: 60, depositRequired: false, depositType: "fixed", depositValue: 0 },
        { businessId: business.id, name: "Traitement céramique", category: "ceramic", priceCents: 49900, durationMinutes: 480, depositRequired: true, depositType: "percent", depositValue: 30 },
      ],
    });
    services = await db.service.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } });
  }

  console.log("→ customers + vehicles");
  let customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } });
  if (customers.length === 0) {
    await db.customer.createMany({
      data: [
        { businessId: business.id, fullName: "Karim Benali", email: "karim@example.com", phone: "06 11 22 33 44" },
        { businessId: business.id, fullName: "Julie Martin", email: "julie@example.com", phone: "06 55 66 77 88" },
        { businessId: business.id, fullName: "Marc Dupont", email: "marc@example.com", notes: "Client fidèle, 3 voitures." },
      ],
    });
    customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } });
    await db.vehicle.createMany({
      data: [
        { businessId: business.id, customerId: customers[0].id, make: "Mercedes", model: "C220 CDI", year: 2010, sizeCategory: "sedan" },
        { businessId: business.id, customerId: customers[1].id, make: "Peugeot", model: "208", year: 2021, sizeCategory: "compact" },
        { businessId: business.id, customerId: customers[2].id, make: "Audi", model: "Q5", year: 2019, sizeCategory: "suv" },
      ],
    });
  }

  console.log("→ bookings + payments");
  const bookingCount = await db.booking.count({ where: { businessId: business.id } });
  if (bookingCount === 0) {
    const vehicles = await db.vehicle.findMany({ where: { businessId: business.id } });
    const vFor = (cid) => vehicles.find((v) => v.customerId === cid)?.id ?? null;
    const day = (offset, hour) => {
      const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d;
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
      const deposit = r.s === 0 ? 2000 : r.s === 2 ? Math.round(svc.priceCents * 0.3) : 0;
      const booking = await db.booking.create({
        data: {
          businessId: business.id, serviceId: svc.id, customerId: customers[r.c].id,
          vehicleId: vFor(customers[r.c].id), status: r.status,
          startsAt: r.start, endsAt: new Date(r.start.getTime() + r.dur * 60000),
          totalPriceCents: svc.priceCents, depositAmountCents: deposit, depositPaid: r.depPaid,
        },
      });
      if (r.depPaid && deposit > 0) {
        await db.payment.create({
          data: {
            businessId: business.id, bookingId: booking.id, amountCents: deposit,
            currency: "eur", status: "succeeded", provider: "stripe",
            stripePaymentIntentId: `pi_demo_${booking.id.slice(0, 8)}`,
          },
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

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
