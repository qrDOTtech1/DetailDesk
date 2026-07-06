import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BookingWizard } from "./booking-wizard";

export default async function PublicBookingPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ name?: string; email?: string; phone?: string; make?: string; model?: string }>;
}) {
  const { slug } = await params;
  const prefill = await searchParams;

  const business = await db.business.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true, name: true, slug: true, email: true, phone: true, address: true,
      logoUrl: true, cancellationPolicy: true, stripeConnected: true, businessType: true,
      settings: { select: { showPublicGallery: true } },
    },
  });
  if (!business) notFound();

  // public gallery: only shareable+visible photos of consenting customers
  let galleryPhotos: { id: string; kind: string; caption: string | null }[] = [];
  if (business.settings?.showPublicGallery) {
    const candidates = await db.bookingPhoto.findMany({
      where: { businessId: business.id, isShareable: true, isPublicVisible: true },
      include: { booking: { select: { customerId: true } }, vehicle: { select: { customerId: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 60,
    });
    const ownerIds = [...new Set(candidates
      .map((p) => p.customerId ?? p.booking?.customerId ?? p.vehicle?.customerId)
      .filter((x): x is string => Boolean(x)))];
    const consents = await db.customerConsent.findMany({
      where: { customerId: { in: ownerIds }, consentType: "public_photos", granted: true },
      select: { customerId: true },
    });
    const consented = new Set(consents.map((c) => c.customerId));
    galleryPhotos = candidates
      .filter((p) => {
        const owner = p.customerId ?? p.booking?.customerId ?? p.vehicle?.customerId;
        return owner && consented.has(owner);
      })
      .slice(0, 12)
      .map((p) => ({ id: p.id, kind: p.kind, caption: p.caption }));
  }

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
          prefill={prefill}
        />

        {galleryPhotos.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-center text-lg font-semibold">Nos réalisations</h2>
            <div className="grid grid-cols-3 gap-2">
              {galleryPhotos.map((p) => (
                <figure key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/public-photos/${p.id}`} alt={p.caption ?? "Réalisation"}
                    className="aspect-square w-full rounded-md border object-cover" loading="lazy" />
                  <figcaption className="mt-0.5 text-center text-[11px] text-muted-foreground">
                    {p.kind === "before" ? "Avant" : p.kind === "after" ? "Après" : p.caption ?? ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href={`/b/${business.slug}/portail`} className="underline">Espace client</Link>
          {" · "}Propulsé par DetailDesk
          {" · "}<Link href="/legal/confidentialite" className="underline">Confidentialité</Link>
        </p>
      </div>
    </main>
  );
}
