import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookingStatusSchema } from "@/lib/validators";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, EmptyState, StatusBadge } from "@/components/ui";

const filters = [
  ["all", "Toutes"], ["pending", "En attente"], ["confirmed", "Confirmées"],
  ["completed", "Terminées"], ["cancelled", "Annulées"], ["no_show", "No-show"],
] as const;

export default async function BookingsPage({ searchParams }: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string }>;
}) {
  const { status = "all", q = "", from = "", to = "" } = await searchParams;
  const ctx = await requireBusiness();

  const statusFilter = bookingStatusSchema.safeParse(status);
  const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const [bookings, settings] = await Promise.all([
    db.booking.findMany({
      where: {
        businessId: ctx.business.id,
        ...(statusFilter.success ? { status: statusFilter.data } : {}),
        ...(q ? {
          OR: [
            { customer: { fullName: { contains: q, mode: "insensitive" } } },
            { customer: { email: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
            { vehicle: { make: { contains: q, mode: "insensitive" } } },
            { vehicle: { model: { contains: q, mode: "insensitive" } } },
            { vehicle: { plate: { contains: q, mode: "insensitive" } } },
            { service: { name: { contains: q, mode: "insensitive" } } },
          ],
        } : {}),
        ...(dateOk(from) ? { startsAt: { gte: new Date(`${from}T00:00:00`) } } : {}),
        ...(dateOk(to) ? { endsAt: { lte: new Date(`${to}T23:59:59`) } } : {}),
      },
      include: { service: true, customer: true, vehicle: true },
      orderBy: { startsAt: "desc" }, take: 100,
    }),
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";
  const keep = (extra: string) => `/dashboard/bookings?${extra}${q ? `&q=${encodeURIComponent(q)}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Réservations</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-3">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-48 flex-1">
          <label className="text-xs text-muted-foreground">Recherche (client, email, véhicule, plaque, service)</label>
          <input name="q" defaultValue={q} placeholder="karim, mercedes, AB-123…"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Du</label>
          <input name="from" type="date" defaultValue={from}
            className="mt-1 flex h-9 rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Au</label>
          <input name="to" type="date" defaultValue={to}
            className="mt-1 flex h-9 rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <Button type="submit" size="sm">Filtrer</Button>
        {(q || from || to) && (
          <Link href={`/dashboard/bookings?status=${status}`}>
            <Button type="button" variant="ghost" size="sm">Réinitialiser</Button>
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <Link key={value} href={keep(`status=${value}`)}>
            <Button variant={status === value ? "default" : "outline"} size="sm">{label}</Button>
          </Link>
        ))}
      </div>
      {bookings.length === 0 ? (
        <EmptyState title="Aucune réservation" description="Partage ton lien public pour en recevoir." />
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="block">
              <Card className="hover:bg-accent">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{b.customer.fullName} — {b.service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(b.startsAt.toISOString(), tz)}
                      {b.vehicle ? ` · ${b.vehicle.make} ${b.vehicle.model}` : ""}
                      {" · "}{formatCents(b.totalPriceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.depositAmountCents > 0 && (
                      <Badge variant={b.depositPaid ? "success" : "warning"}>
                        Acompte {b.depositPaid ? "payé" : "en attente"}
                      </Badge>
                    )}
                    <StatusBadge status={b.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
