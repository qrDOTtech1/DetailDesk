import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, StatusBadge } from "@/components/ui";
import { CustomerForm, VehicleForm } from "../customer-form";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const [{ data: customer }, { data: vehicles }, { data: bookings }, { data: settings }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).eq("business_id", ctx.business.id).maybeSingle(),
    supabase.from("vehicles").select("*").eq("customer_id", id).eq("business_id", ctx.business.id).order("created_at"),
    supabase.from("bookings").select("*, services(name)").eq("customer_id", id)
      .eq("business_id", ctx.business.id).order("starts_at", { ascending: false }),
    supabase.from("business_settings").select("timezone").eq("business_id", ctx.business.id).maybeSingle(),
  ]);
  if (!customer) notFound();
  const tz = settings?.timezone ?? "Europe/Paris";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers" className="text-sm text-muted-foreground hover:underline">← Clients</Link>
      <h1 className="text-xl font-bold">{customer.full_name}</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Infos client</CardTitle></CardHeader>
          <CardContent><CustomerForm customer={customer} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Véhicules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(vehicles ?? []).map((v) => (
              <div key={v.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{v.make} {v.model} {v.year ?? ""}</p>
                <p className="text-muted-foreground">{[v.plate, v.size_category].filter(Boolean).join(" · ")}</p>
                {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
              </div>
            ))}
            <div className="border-t pt-3"><VehicleForm customerId={customer.id} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Historique réservations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(bookings ?? []).length === 0 ? <EmptyState title="Aucune réservation" /> :
              bookings!.map((b) => (
                <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                  <div>
                    <p className="font-medium">{(b.services as { name?: string } | null)?.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.starts_at, tz)} · {formatCents(b.total_price_cents)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
