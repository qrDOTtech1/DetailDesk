import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, EmptyState, StatusBadge } from "@/components/ui";

const filters = [
  ["all", "Toutes"], ["pending", "En attente"], ["confirmed", "Confirmées"],
  ["completed", "Terminées"], ["cancelled", "Annulées"], ["no_show", "No-show"],
] as const;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const ctx = await requireBusiness();
  const supabase = await createClient();

  let query = supabase.from("bookings")
    .select("*, services(name), customers(full_name), vehicles(make, model)")
    .eq("business_id", ctx.business.id).order("starts_at", { ascending: false }).limit(100);
  if (status !== "all") query = query.eq("status", status);
  const [{ data: bookings }, { data: settings }] = await Promise.all([
    query,
    supabase.from("business_settings").select("timezone").eq("business_id", ctx.business.id).maybeSingle(),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Réservations</h1>
      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <Link key={value} href={`/dashboard/bookings?status=${value}`}>
            <Button variant={status === value ? "default" : "outline"} size="sm">{label}</Button>
          </Link>
        ))}
      </div>
      {(bookings ?? []).length === 0 ? (
        <EmptyState title="Aucune réservation" description="Partage ton lien public pour en recevoir." />
      ) : (
        <div className="space-y-2">
          {bookings!.map((b) => (
            <Link key={b.id} href={`/dashboard/bookings/${b.id}`} className="block">
              <Card className="hover:bg-accent">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">
                      {(b.customers as { full_name?: string } | null)?.full_name} — {(b.services as { name?: string } | null)?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(b.starts_at, tz)}
                      {b.vehicles ? ` · ${(b.vehicles as { make?: string; model?: string }).make} ${(b.vehicles as { make?: string; model?: string }).model}` : ""}
                      {" · "}{formatCents(b.total_price_cents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.deposit_amount_cents > 0 && (
                      <Badge variant={b.deposit_paid ? "success" : "warning"}>
                        Acompte {b.deposit_paid ? "payé" : "en attente"}
                      </Badge>
                    )}
                    <StatusBadge status={b.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
