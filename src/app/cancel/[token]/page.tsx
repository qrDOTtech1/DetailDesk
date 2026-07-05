import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { CancelForm } from "./cancel-form";

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();

  const booking = await db.booking.findUnique({
    where: { publicCancelToken: token },
    include: { service: true, customer: true, business: true },
  });
  if (!booking) notFound();

  const settings = await db.businessSettings.findUnique({
    where: { businessId: booking.businessId }, select: { timezone: true },
  });
  const tz = settings?.timezone ?? "Europe/Paris";
  const cancellable = ["pending", "confirmed"].includes(booking.status) && booking.startsAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Annuler ma réservation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border p-4">
            <p><strong>{booking.business.name}</strong> — {booking.service.name}</p>
            <p className="text-muted-foreground">{formatDateTime(booking.startsAt.toISOString(), tz)} · {formatCents(booking.totalPriceCents)}</p>
            <p className="mt-1"><StatusBadge status={booking.status} /></p>
          </div>
          {booking.business.cancellationPolicy && <p className="text-xs text-muted-foreground">{booking.business.cancellationPolicy}</p>}
          {booking.depositPaid && (
            <p className="text-xs text-muted-foreground">
              Acompte déjà payé : le remboursement éventuel est géré directement par le professionnel.
            </p>
          )}
          {cancellable
            ? <CancelForm token={token} />
            : <p className="text-muted-foreground">Cette réservation ne peut plus être annulée en ligne.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
