import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { ManualBookingForm } from "./manual-form";

export default async function NewBookingPage() {
  const ctx = await requireBusiness();
  const [services, customers] = await Promise.all([
    db.service.findMany({
      where: { businessId: ctx.business.id, isActive: true }, orderBy: { name: "asc" },
      select: { id: true, name: true, priceCents: true, durationMinutes: true },
    }),
    db.customer.findMany({
      where: { businessId: ctx.business.id }, orderBy: { fullName: "asc" }, take: 500,
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/dashboard/bookings" className="text-sm text-muted-foreground hover:underline">← Réservations</Link>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle réservation manuelle</CardTitle>
          <CardDescription>
            Pour les demandes reçues par téléphone, Instagram ou WhatsApp. La réservation est
            confirmée directement, sans acompte en ligne.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualBookingForm
            services={services.map((s) => ({ id: s.id, name: s.name, price_cents: s.priceCents, duration: s.durationMinutes }))}
            customers={customers.map((c) => ({ id: c.id, label: c.fullName + (c.email ? ` (${c.email})` : "") }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
