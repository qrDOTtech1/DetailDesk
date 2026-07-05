import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, StatusBadge } from "@/components/ui";
import { CustomerForm, VehicleForm } from "../customer-form";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();

  const [customer, vehicles, bookings, settings] = await Promise.all([
    db.customer.findFirst({ where: { id, businessId: ctx.business.id } }),
    db.vehicle.findMany({ where: { customerId: id, businessId: ctx.business.id }, orderBy: { createdAt: "asc" } }),
    db.booking.findMany({
      where: { customerId: id, businessId: ctx.business.id },
      include: { service: true }, orderBy: { startsAt: "desc" },
    }),
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
  ]);
  if (!customer) notFound();
  const tz = settings?.timezone ?? "Europe/Paris";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers" className="text-sm text-muted-foreground hover:underline">← Clients</Link>
      <h1 className="text-xl font-bold">{customer.fullName}</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Infos client</CardTitle></CardHeader>
          <CardContent>
            <CustomerForm customer={{
              id: customer.id, full_name: customer.fullName, email: customer.email, phone: customer.phone, notes: customer.notes,
            }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Véhicules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vehicles.map((v) => (
              <div key={v.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{v.make} {v.model} {v.year ?? ""}</p>
                <p className="text-muted-foreground">{[v.plate, v.sizeCategory].filter(Boolean).join(" · ")}</p>
                {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
              </div>
            ))}
            <div className="border-t pt-3"><VehicleForm customerId={customer.id} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Historique réservations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bookings.length === 0 ? <EmptyState title="Aucune réservation" /> :
              bookings.map((b) => (
                <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                  <div>
                    <p className="font-medium">{b.service.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.startsAt.toISOString(), tz)} · {formatCents(b.totalPriceCents)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
