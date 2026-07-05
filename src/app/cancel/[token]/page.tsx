import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { CancelForm } from "./cancel-form";

export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();

  const supabase = createAdminClient();
  const { data: booking } = await supabase.from("bookings")
    .select("id, status, starts_at, total_price_cents, deposit_amount_cents, deposit_paid, services(name), customers(full_name), businesses(name, slug, cancellation_policy), business_id")
    .eq("public_cancel_token", token).maybeSingle();
  if (!booking) notFound();

  const { data: settings } = await supabase.from("business_settings")
    .select("timezone").eq("business_id", booking.business_id).maybeSingle();
  const tz = settings?.timezone ?? "Europe/Paris";
  const biz = booking.businesses as { name?: string; cancellation_policy?: string | null } | null;
  const cancellable = ["pending", "confirmed"].includes(booking.status) && new Date(booking.starts_at) > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Annuler ma réservation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border p-4">
            <p><strong>{biz?.name}</strong> — {(booking.services as { name?: string } | null)?.name}</p>
            <p className="text-muted-foreground">{formatDateTime(booking.starts_at, tz)} · {formatCents(booking.total_price_cents)}</p>
            <p className="mt-1"><StatusBadge status={booking.status} /></p>
          </div>
          {biz?.cancellation_policy && <p className="text-xs text-muted-foreground">{biz.cancellation_policy}</p>}
          {booking.deposit_paid && (
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
