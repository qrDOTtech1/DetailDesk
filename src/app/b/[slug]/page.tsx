import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BookingWizard } from "./booking-wizard";

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const business = await db.business.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true, name: true, slug: true, email: true, phone: true, address: true,
      logoUrl: true, cancellationPolicy: true, stripeConnected: true, businessType: true,
    },
  });
  if (!business) notFound();

  const services = await db.service.findMany({
    where: { businessId: business.id, isActive: true },
    orderBy: { priceCents: "asc" },
    select: {
      id: true, name: true, description: true, category: true, priceCents: true,
      durationMinutes: true, depositRequired: true, depositType: true, depositValue: true,
      addons: {
        where: { isActive: true }, orderBy: { createdAt: "asc" },
        select: { id: true, name: true, priceCents: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-xl px-4 py-8">
        <header className="mb-6 text-center">
          {business.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt={business.name} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
          )}
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[business.address, business.phone, business.email].filter(Boolean).join(" · ")}
          </p>
        </header>
        <BookingWizard
          slug={business.slug}
          services={services.map((s) => ({
            id: s.id, name: s.name, description: s.description, category: s.category,
            price_cents: s.priceCents, duration_minutes: s.durationMinutes,
            deposit_required: s.depositRequired, deposit_type: s.depositType, deposit_value: s.depositValue,
            addons: s.addons.map((a) => ({ id: a.id, name: a.name, price_cents: a.priceCents })),
          }))}
          stripeConnected={business.stripeConnected}
          cancellationPolicy={business.cancellationPolicy}
        />
        <p className="mt-8 text-center text-xs text-muted-foreground">Propulsé par DetailDesk</p>
      </div>
    </main>
  );
}
