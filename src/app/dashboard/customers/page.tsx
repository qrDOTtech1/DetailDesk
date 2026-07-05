import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { CustomerForm } from "./customer-form";

export default async function CustomersPage() {
  const ctx = await requireBusiness();
  const customers = await db.customer.findMany({
    where: { businessId: ctx.business.id },
    include: { _count: { select: { vehicles: true, bookings: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Clients</h1>
        {customers.length === 0 ? (
          <EmptyState title="Aucun client" description="Les clients se créent aussi automatiquement via les réservations publiques." />
        ) : customers.map((c) => (
          <Link key={c.id} href={`/dashboard/customers/${c.id}`} className="block">
            <Card className="hover:bg-accent">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{c.fullName}</p>
                  <p className="text-sm text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c._count.vehicles} véhicule(s) · {c._count.bookings} résa(s)
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
