import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { Button, Card, CardContent, EmptyState, StatusBadge } from "@/components/ui";

export default async function InvoicesPage() {
  const ctx = await requireBusiness();
  const invoices = await db.invoice.findMany({
    where: { businessId: ctx.business.id },
    include: { customer: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Factures</h1>
        <Link href="/dashboard/invoices/new"><Button size="sm">+ Facture</Button></Link>
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="Aucune facture" description="Crée ta première facture depuis une réservation terminée ou manuellement."
          action={<Link href="/dashboard/invoices/new"><Button>Créer une facture</Button></Link>} />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}
                className="flex items-center justify-between p-4 text-sm hover:bg-accent">
                <div>
                  <p className="font-medium">{inv.number ?? "Brouillon"} — {inv.customer.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("fr-FR") : "Non émise"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatCents(inv.totalCents)}</span>
                  <StatusBadge status={inv.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
