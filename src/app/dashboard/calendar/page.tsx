import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { Button, StatusBadge } from "@/components/ui";

const DAY_MS = 24 * 3600_000;

function mondayOf(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  return new Date(x.getTime() - day * DAY_MS);
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const ctx = await requireBusiness();

  const base = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? new Date(`${week}T12:00:00`) : new Date();
  const monday = mondayOf(base);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY_MS));
  const weekEnd = new Date(monday.getTime() + 7 * DAY_MS);

  const [bookings, settings] = await Promise.all([
    db.booking.findMany({
      where: {
        businessId: ctx.business.id,
        startsAt: { gte: monday, lt: weekEnd },
        status: { in: ["pending", "confirmed", "completed", "no_show"] },
      },
      include: { service: true, customer: true },
      orderBy: { startsAt: "asc" },
    }),
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";

  const fmtDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(d);
  const fmtTime = (d: Date) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d);
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = dayKey(new Date());

  const prev = iso(new Date(monday.getTime() - 7 * DAY_MS));
  const next = iso(new Date(monday.getTime() + 7 * DAY_MS));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">
          Semaine du {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: tz }).format(monday)}
        </h1>
        <div className="flex gap-2">
          <Link href={`/dashboard/calendar?week=${prev}`}><Button variant="outline" size="sm">← Préc.</Button></Link>
          <Link href="/dashboard/calendar"><Button variant="outline" size="sm">Aujourd&apos;hui</Button></Link>
          <Link href={`/dashboard/calendar?week=${next}`}><Button variant="outline" size="sm">Suiv. →</Button></Link>
          <Link href="/dashboard/bookings/new"><Button size="sm">+ Réservation</Button></Link>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const key = dayKey(d);
          const dayBookings = bookings.filter((b) => dayKey(b.startsAt) === key);
          return (
            <div key={key}
              className={`rounded-lg border bg-background p-2 ${key === today ? "border-primary ring-1 ring-primary/30" : ""}`}>
              <p className={`mb-2 text-xs font-semibold ${key === today ? "text-primary" : "text-muted-foreground"}`}>
                {fmtDay(d)}
              </p>
              <div className="space-y-1.5">
                {dayBookings.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">—</p>
                ) : dayBookings.map((b) => (
                  <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
                    className={`block rounded-md border p-1.5 text-xs hover:bg-accent ${b.status === "cancelled" ? "opacity-50 line-through" : ""} ${b.status === "pending" ? "border-amber-300 bg-amber-50" : ""}`}>
                    <p className="font-semibold">{fmtTime(b.startsAt)} · {b.customer.fullName.split(" ")[0]}</p>
                    <p className="truncate text-muted-foreground">{b.service.name}</p>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span>{formatCents(b.totalPriceCents)}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Fuseau : {tz}. Les réservations en attente sont surlignées.</p>
    </div>
  );
}
