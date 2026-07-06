import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ booking_id?: string }> }) {
  const ctx = await requireBusiness();
  const { booking_id } = await searchParams;
  const [customers, bookings, preselected] = await Promise.all([
    db.customer.findMany({
      where: { businessId: ctx.business.id }, orderBy: { fullName: "asc" }, take: 500,
      select: { id: true, fullName: true, email: true },
    }),
    db.booking.findMany({
      where: { businessId: ctx.business.id, status: "completed" },
      orderBy: { startsAt: "desc" }, take: 200,
      select: { id: true, customerId: true, startsAt: true, totalPriceCents: true, service: { select: { name: true } } },
    }),
    booking_id
      ? db.booking.findFirst({ where: { id: booking_id, businessId: ctx.business.id }, select: { id: true, customerId: true } })
      : null,
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/dashboard/invoices" className="text-sm text-muted-foreground hover:underline">← Factures</Link>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle facture</CardTitle>
          <CardDescription>
            Choisis une réservation terminée pour pré-remplir les lignes, ou ajoute des lignes libres.
            La facture est créée en brouillon — tu l&apos;émets (numéro officiel) quand elle est prête.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewInvoiceForm
            customers={customers.map((c) => ({ id: c.id, label: c.fullName + (c.email ? ` (${c.email})` : "") }))}
            bookings={bookings.map((b) => ({
              id: b.id, customerId: b.customerId,
              label: `${b.service.name} — ${new Date(b.startsAt).toLocaleDateString("fr-FR")}`,
            }))}
            preselect={preselected ? { customerId: preselected.customerId, bookingId: preselected.id } : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
