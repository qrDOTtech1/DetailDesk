import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function ConfirmedPage({ params, searchParams }: {
  params: Promise<{ slug: string; bookingId: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { slug, bookingId } = await params;
  const { paid } = await searchParams;
  const supabase = createAdminClient();

  const { data: business } = await supabase.from("businesses")
    .select("id, name").eq("slug", slug).maybeSingle();
  if (!business) notFound();

  const { data: booking } = await supabase.from("bookings")
    .select("*, services(name), customers(full_name)")
    .eq("id", bookingId).eq("business_id", business.id).maybeSingle();
  if (!booking) notFound();

  const { data: settings } = await supabase.from("business_settings")
    .select("timezone, confirmation_message").eq("business_id", business.id).maybeSingle();
  const tz = settings?.timezone ?? "Europe/Paris";
  const paymentCancelled = paid === "0" && booking.deposit_amount_cents > 0 && !booking.deposit_paid;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            {paymentCancelled ? "⏳" : "✅"}
          </div>
          <CardTitle>
            {paymentCancelled ? "Réservation enregistrée — acompte en attente" : "Réservation confirmée !"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border p-4 text-left">
            <p><span className="text-muted-foreground">Business :</span> <strong>{business.name}</strong></p>
            <p><span className="text-muted-foreground">Service :</span> {(booking.services as { name?: string } | null)?.name}</p>
            <p><span className="text-muted-foreground">Date :</span> {formatDateTime(booking.starts_at, tz)}</p>
            <p><span className="text-muted-foreground">Prix :</span> {formatCents(booking.total_price_cents)}</p>
            {booking.deposit_amount_cents > 0 && (
              <p>
                <span className="text-muted-foreground">Acompte :</span> {formatCents(booking.deposit_amount_cents)}{" "}
                <Badge variant={booking.deposit_paid ? "success" : "warning"}>
                  {booking.deposit_paid ? "payé" : "en attente"}
                </Badge>
              </p>
            )}
          </div>
          {paymentCancelled && (
            <p className="text-muted-foreground">
              Le paiement de l&apos;acompte a été interrompu. Le pro pourra te recontacter pour finaliser.
            </p>
          )}
          {settings?.confirmation_message && <p className="text-muted-foreground">{settings.confirmation_message}</p>}
          <p className="text-muted-foreground">Un email de confirmation t&apos;a été envoyé.</p>
          <Link href={`/b/${slug}`} className="text-sm underline">← Retour à la page de réservation</Link>
        </CardContent>
      </Card>
    </main>
  );
}
