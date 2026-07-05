import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function ConfirmedPage({ params, searchParams }: {
  params: Promise<{ slug: string; bookingId: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { slug, bookingId } = await params;
  const { paid } = await searchParams;

  const business = await db.business.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!business) notFound();

  const booking = await db.booking.findFirst({
    where: { id: bookingId, businessId: business.id },
    include: { service: true, customer: true },
  });
  if (!booking) notFound();

  const settings = await db.businessSettings.findUnique({
    where: { businessId: business.id }, select: { timezone: true, confirmationMessage: true },
  });
  const tz = settings?.timezone ?? "Europe/Paris";
  const paymentCancelled = paid === "0" && booking.depositAmountCents > 0 && !booking.depositPaid;

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
            <p><span className="text-muted-foreground">Service :</span> {booking.service.name}</p>
            <p><span className="text-muted-foreground">Date :</span> {formatDateTime(booking.startsAt.toISOString(), tz)}</p>
            <p><span className="text-muted-foreground">Prix :</span> {formatCents(booking.totalPriceCents)}</p>
            {booking.depositAmountCents > 0 && (
              <p>
                <span className="text-muted-foreground">Acompte :</span> {formatCents(booking.depositAmountCents)}{" "}
                <Badge variant={booking.depositPaid ? "success" : "warning"}>
                  {booking.depositPaid ? "payé" : "en attente"}
                </Badge>
              </p>
            )}
          </div>
          {paymentCancelled && (
            <p className="text-muted-foreground">
              Le paiement de l&apos;acompte a été interrompu. Le pro pourra te recontacter pour finaliser.
            </p>
          )}
          {settings?.confirmationMessage && <p className="text-muted-foreground">{settings.confirmationMessage}</p>}
          <p className="text-muted-foreground">Un email de confirmation t&apos;a été envoyé.</p>
          <Link href={`/b/${slug}`} className="text-sm underline">← Retour à la page de réservation</Link>
        </CardContent>
      </Card>
    </main>
  );
}
