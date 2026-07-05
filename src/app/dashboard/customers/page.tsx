import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { CustomerForm } from "./customer-form";

export default async function CustomersPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { data: customers } = await supabase.from("customers")
    .select("*, vehicles(count), bookings(count)")
    .eq("business_id", ctx.business.id).order("created_at", { ascending: false });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Clients</h1>
        {(customers ?? []).length === 0 ? (
          <EmptyState title="Aucun client" description="Les clients se créent aussi automatiquement via les réservations publiques." />
        ) : customers!.map((c) => (
          <Link key={c.id} href={`/dashboard/customers/${c.id}`} className="block">
            <Card className="hover:bg-accent">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.full_name}</p>
                  <p className="text-sm text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(c.vehicles as { count: number }[])?.[0]?.count ?? 0} véhicule(s) · {(c.bookings as { count: number }[])?.[0]?.count ?? 0} résa(s)
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="h-fit">
        <CardHeader><CardTitle>Nouveau client</CardTitle></CardHeader>
        <CardContent><CustomerForm /></CardContent>
      </Card>
    </div>
  );
}
