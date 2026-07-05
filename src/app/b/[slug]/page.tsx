import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingWizard } from "./booking-wizard";

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: business } = await supabase.from("businesses")
    .select("id, name, slug, email, phone, address, logo_url, cancellation_policy, stripe_connected, business_type")
    .eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!business) notFound();

  const { data: services } = await supabase.from("services")
    .select("id, name, description, category, price_cents, duration_minutes, deposit_required, deposit_type, deposit_value")
    .eq("business_id", business.id).eq("is_active", true).order("price_cents");

  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-xl px-4 py-8">
        <header className="mb-6 text-center">
          {business.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt={business.name} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover" />
          )}
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[business.address, business.phone, business.email].filter(Boolean).join(" · ")}
          </p>
        </header>
        <BookingWizard
          slug={business.slug}
          services={services ?? []}
          stripeConnected={business.stripe_connected}
          cancellationPolicy={business.cancellation_policy}
        />
        <p className="mt-8 text-center text-xs text-muted-foreground">Propulsé par DetailDesk</p>
      </div>
    </main>
  );
}
