import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateBookingStatus } from "../../actions";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@/components/ui";

const transitions: Record<string, [string, string][]> = {
  pending: [["confirmed", "Confirmer"], ["cancelled", "Annuler"]],
  confirmed: [["completed", "Marquer terminée"], ["no_show", "No-show"], ["cancelled", "Annuler"]],
  completed: [], cancelled: [], no_show: [],
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const [{ data: b }, { data: settings }, { data: history }, { data: payments }] = await Promise.all([
    supabase.from("bookings")
      .select("*, services(name, duration_minutes), customers(id, full_name, email, phone), vehicles(make, model, year, plate)")
      .eq("id", id).eq("business_id", ctx.business.id).maybeSingle(),
    supabase.from("business_settings").select("timezone").eq("business_id", ctx.business.id).maybeSingle(),
    supabase.from("booking_status_history").select("*").eq("booking_id", id).order("changed_at", { ascending: false }),
    supabase.from("payments").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
  ]);
  if (!b) notFound();
  const tz = settings?.timezone ?? "Europe/Paris";
  const customer = b.customers as { id: string; full_name: string; email: string | null; phone: string | null } | null;
  const vehicle = b.vehicles as { make: string; model: string; year: number | null; plate: string | null } | null;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/bookings" className="text-sm text-muted-foreground hover:underline">← Réservations</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{(b.services as { name?: string } | null)?.name} — {customer?.full_name}</h1>
        <StatusBadge status={b.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(transitions[b.status] ?? []).map(([status, label]) => (
          <form key={status} action={updateBookingStatus}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="status" value={status} />
            <Button type="submit" variant={status === "cancelled" ? "destructive" : "default"} size="sm">{label}</Button>
          </form>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Détails</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Date :</span> {formatDateTime(b.starts_at, tz)}</p>
            <p><span className="text-muted-foreground">Fin :</span> {formatDateTime(b.ends_at, tz)}</p>
            <p><span className="text-muted-foreground">Prix :</span> {formatCents(b.total_price_cents)}</p>
            <p>
              <span className="text-muted-foreground">Acompte :</span> {formatCents(b.deposit_amount_cents)}{" "}
              {b.deposit_amount_cents > 0 && (
                <Badge variant={b.deposit_paid ? "success" : "warning"}>{b.deposit_paid ? "payé" : "non payé"}</Badge>
              )}
            </p>
            {b.notes && <p><span className="text-muted-foreground">Notes :</span> {b.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Client & véhicule</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer && (
              <p>
                <Link href={`/dashboard/customers/${customer.id}`} className="font-medium hover:underline">
                  {customer.full_name}
                </Link><br />
                <span className="text-muted-foreground">{[customer.email, customer.phone].filter(Boolean).join(" · ")}</span>
              </p>
            )}
            {vehicle && <p>{vehicle.make} {vehicle.model} {vehicle.year ?? ""} {vehicle.plate ? `· ${vehicle.plate}` : ""}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Paiements & historique</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(payments ?? []).map((p) => (
              <div key={p.id} className="flex justify-between rounded-md border p-2">
                <span>{formatCents(p.amount_cents)}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
            {(history ?? []).map((h) => (
              <p key={h.id} className="text-xs text-muted-foreground">
                {formatDateTime(h.changed_at, tz)} : {h.old_status ?? "—"} → {h.new_status}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
