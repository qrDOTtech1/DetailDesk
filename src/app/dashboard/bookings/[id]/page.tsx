import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateBookingStatus } from "../../actions";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { PhotoPanel } from "./photo-panel";
import { RescheduleForm } from "./reschedule-form";
import { RefundButton } from "./refund-button";

const transitions: Record<string, [string, string][]> = {
  pending: [["confirmed", "Confirmer"], ["cancelled", "Annuler"]],
  confirmed: [["completed", "Marquer terminée"], ["no_show", "No-show"], ["cancelled", "Annuler"]],
  completed: [], cancelled: [], no_show: [],
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();

  const booking = await db.booking.findFirst({
    where: { id, businessId: ctx.business.id },
    include: {
      service: true, customer: true, vehicle: true,
      bookingAddons: true,
      photos: { select: { id: true, kind: true, isShareable: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) notFound();

  const consent = await db.customerConsent.findUnique({
    where: { customerId_consentType: { customerId: booking.customerId, consentType: "public_photos" } },
  });

  const [settings, history, payments] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
    db.bookingStatusHistory.findMany({ where: { bookingId: id }, orderBy: { changedAt: "desc" } }),
    db.payment.findMany({ where: { bookingId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/bookings" className="text-sm text-muted-foreground hover:underline">← Réservations</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{booking.service.name} — {booking.customer.fullName}</h1>
        <StatusBadge status={booking.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(transitions[booking.status] ?? []).map(([status, label]) => (
          <form key={status} action={updateBookingStatus}>
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="status" value={status} />
            <Button type="submit" variant={status === "cancelled" ? "destructive" : "default"} size="sm">{label}</Button>
          </form>
        ))}
        {["pending", "confirmed"].includes(booking.status) && <RescheduleForm bookingId={booking.id} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Détails</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Date :</span> {formatDateTime(booking.startsAt.toISOString(), tz)}</p>
            <p><span className="text-muted-foreground">Fin :</span> {formatDateTime(booking.endsAt.toISOString(), tz)}</p>
            <p><span className="text-muted-foreground">Prix :</span> {formatCents(booking.totalPriceCents)}</p>
            {booking.bookingAddons.length > 0 && (
              <p>
                <span className="text-muted-foreground">Options :</span>{" "}
                {booking.bookingAddons.map((a) => `${a.name} (+${formatCents(a.priceCents)})`).join(", ")}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Acompte :</span> {formatCents(booking.depositAmountCents)}{" "}
              {booking.depositAmountCents > 0 && (
                <Badge variant={booking.depositPaid ? "success" : "warning"}>{booking.depositPaid ? "payé" : "non payé"}</Badge>
              )}
            </p>
            {booking.notes && <p><span className="text-muted-foreground">Notes :</span> {booking.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Client & véhicule</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <Link href={`/dashboard/customers/${booking.customer.id}`} className="font-medium hover:underline">
                {booking.customer.fullName}
              </Link><br />
              <span className="text-muted-foreground">{[booking.customer.email, booking.customer.phone].filter(Boolean).join(" · ")}</span>
            </p>
            {booking.vehicle && (
              <p>{booking.vehicle.make} {booking.vehicle.model} {booking.vehicle.year ?? ""} {booking.vehicle.plate ? `· ${booking.vehicle.plate}` : ""}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Paiements & historique</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between rounded-md border p-2">
                <span>{formatCents(p.amountCents)}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
            {["cancelled", "no_show"].includes(booking.status) && payments.some((p) => p.status === "succeeded") && (
              <RefundButton bookingId={booking.id} />
            )}
            {history.map((h) => (
              <p key={h.id} className="text-xs text-muted-foreground">
                {formatDateTime(h.changedAt.toISOString(), tz)} : {h.oldStatus ?? "—"} → {h.newStatus}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <PhotoPanel bookingId={booking.id} consentGranted={Boolean(consent?.granted)}
        photos={booking.photos.map((p) => ({ id: p.id, kind: p.kind, isShareable: p.isShareable }))} />
    </div>
  );
}
