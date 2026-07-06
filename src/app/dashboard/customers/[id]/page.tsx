import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, CopyButton, EmptyState, StatusBadge } from "@/components/ui";
import { MakeLogo } from "@/components/vehicle-picker";
import { CustomerForm, VehicleForm } from "../customer-form";
import { toggleCustomerVip, setCustomerConsent } from "../../actions";
import { appUrl } from "@/lib/stripe";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();

  const [customer, vehicles, bookings, settings] = await Promise.all([
    db.customer.findFirst({ where: { id, businessId: ctx.business.id } }),
    db.vehicle.findMany({ where: { customerId: id, businessId: ctx.business.id }, orderBy: { createdAt: "asc" } }),
    db.booking.findMany({
      where: { customerId: id, businessId: ctx.business.id },
      include: { service: true }, orderBy: { startsAt: "desc" },
    }),
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
  ]);
  if (!customer) notFound();
  const tz = settings?.timezone ?? "Europe/Paris";

  const consent = await db.customerConsent.findUnique({
    where: { customerId_consentType: { customerId: id, consentType: "public_photos" } },
  });

  const completed = (bookings ?? []).filter((b) => b.status === "completed");
  const totalSpent = completed.reduce((s, b) => s + b.totalPriceCents, 0);
  const lastVisit = completed[0]?.startsAt ?? null;
  const loyalty = customer.isVip ? { label: "VIP ⭐", variant: "success" }
    : completed.length >= 5 ? { label: "Fidèle", variant: "success" }
    : completed.length >= 2 ? { label: "Régulier", variant: "secondary" }
    : { label: "Nouveau", variant: "muted" };

  const rebookUrl = appUrl(
    `/b/${ctx.business.slug}?name=${encodeURIComponent(customer.fullName)}` +
    `&email=${encodeURIComponent(customer.email ?? "")}&phone=${encodeURIComponent(customer.phone ?? "")}` +
    (vehicles?.[0] ? `&make=${encodeURIComponent(vehicles[0].make)}&model=${encodeURIComponent(vehicles[0].model)}` : "")
  );

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers" className="text-sm text-muted-foreground hover:underline">← Clients</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{customer.fullName}</h1>
          <Badge variant={loyalty.variant}>{loyalty.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={rebookUrl} label="Copier le lien de rebooking" />
          <form action={toggleCustomerVip}>
            <input type="hidden" name="id" value={customer.id} />
            <Button variant="outline" size="sm" type="submit">{customer.isVip ? "Retirer VIP" : "Marquer VIP"}</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-background p-4 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Prestations terminées</p>
          <p className="text-lg font-semibold">{completed.length}</p></div>
        <div><p className="text-xs text-muted-foreground">Total dépensé</p>
          <p className="text-lg font-semibold">{formatCents(totalSpent)}</p></div>
        <div><p className="text-xs text-muted-foreground">Dernière visite</p>
          <p className="text-sm font-medium">{lastVisit ? formatDateTime(lastVisit.toISOString(), tz) : "—"}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">Photos publiques</p>
          <form action={setCustomerConsent} className="mt-1">
            <input type="hidden" name="customer_id" value={customer.id} />
            <input type="hidden" name="granted" value={consent?.granted ? "false" : "true"} />
            <Button variant={consent?.granted ? "outline" : "secondary"} size="sm" type="submit">
              {consent?.granted ? "Accord donné ✅ (révoquer)" : "Enregistrer l'accord"}
            </Button>
          </form>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Infos client</CardTitle></CardHeader>
          <CardContent>
            <CustomerForm customer={{
              id: customer.id, full_name: customer.fullName, email: customer.email, phone: customer.phone, notes: customer.notes,
            }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Véhicules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <MakeLogo make={v.make} className="h-10 w-10 shrink-0" />
                <div>
                  <p className="font-medium">{v.make} {v.model} {v.year ?? ""}</p>
                  <p className="text-muted-foreground">{[v.trim, v.plate, v.sizeCategory].filter(Boolean).join(" · ")}</p>
                  {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                </div>
              </div>
            ))}
            <div className="border-t pt-3"><VehicleForm customerId={customer.id} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Historique réservations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bookings.length === 0 ? <EmptyState title="Aucune réservation" /> :
              bookings.map((b) => (
                <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                  <div>
                    <p className="font-medium">{b.service.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(b.startsAt.toISOString(), tz)} · {formatCents(b.totalPriceCents)}</p>
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
