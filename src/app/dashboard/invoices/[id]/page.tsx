import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { issueInvoice, markInvoicePaid, cancelInvoice, deleteDraftInvoice } from "../actions";
import { SendInvoiceButton } from "./send-button";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();

  const invoice = await db.invoice.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { lines: { orderBy: { sortOrder: "asc" } }, customer: true, booking: { select: { id: true } } },
  });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/dashboard/invoices" className="text-sm text-muted-foreground hover:underline">← Factures</Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{invoice.number ?? "Brouillon"}</h1>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="flex flex-wrap gap-2">
        {invoice.status === "draft" && (
          <>
            <form action={issueInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm">Émettre (attribue le numéro officiel)</Button>
            </form>
            <form action={deleteDraftInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
            </form>
          </>
        )}
        {invoice.status === "issued" && (
          <>
            <form action={markInvoicePaid}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm">Marquer payée</Button>
            </form>
            <form action={cancelInvoice}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" variant="outline" size="sm">Annuler</Button>
            </form>
          </>
        )}
        <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">Télécharger le PDF</Button>
        </a>
        {invoice.status !== "draft" && invoice.customer.email && (
          <SendInvoiceButton invoiceId={invoice.id} />
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Client</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">{invoice.customer.fullName}</p>
          {invoice.customer.email && <p className="text-muted-foreground">{invoice.customer.email}</p>}
          {invoice.customer.phone && <p className="text-muted-foreground">{invoice.customer.phone}</p>}
          {invoice.booking && (
            <Link href={`/dashboard/bookings/${invoice.booking.id}`} className="mt-2 inline-block text-xs underline">
              Voir la réservation liée
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {invoice.lines.map((l) => (
            <div key={l.id} className="flex justify-between border-b pb-1 last:border-0">
              <span>{l.description} {l.quantity > 1 ? `×${l.quantity}` : ""}</span>
              <span>{formatCents(l.totalCents)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-muted-foreground">
            <span>Sous-total</span><span>{formatCents(invoice.subtotalCents)}</span>
          </div>
          {invoice.taxRatePercent > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>TVA ({invoice.taxRatePercent}%)</span><span>{formatCents(invoice.taxCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span><span>{formatCents(invoice.totalCents)}</span>
          </div>
          {invoice.notes && <p className="pt-2 text-xs text-muted-foreground">{invoice.notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
