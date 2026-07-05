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

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const ctx = await requireBusiness();

  const statusFilter = bookingStatusSchema.safeParse(status);
  const [bookings, settings] = await Promise.all([
    db.booking.findMany({
      where: { businessId: ctx.business.id, ...(statusFilter.success ? { status: statusFilter.data } : {}) },
      include: { service: true, customer: true, vehicle: true },
      orderBy: { startsAt: "desc" }, take: 100,
    }),
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Réservations</h1>
      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <Link key={value} href={`/dashboard/bookings?status=${value}`}>
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
