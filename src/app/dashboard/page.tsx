import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, CopyButton, EmptyState, StatusBadge } from "@/components/ui";

export default async function DashboardPage() {
  const ctx = await requireBusiness();
  const bid = ctx.business.id;

  const [upcoming, recentCustomers, payments, serviceCounts, settings] = await Promise.all([
    db.booking.findMany({
      where: { businessId: bid, startsAt: { gte: new Date() }, status: { in: ["pending", "confirmed"] } },
      include: { service: true, customer: true },
      orderBy: { startsAt: "asc" }, take: 5,
    }),
    db.customer.findMany({ where: { businessId: bid }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.payment.findMany({ where: { businessId: bid, status: "succeeded" }, select: { amountCents: true } }),
    db.booking.groupBy({ by: ["serviceId"], where: { businessId: bid }, _count: { serviceId: true } }),
    db.businessSettings.findUnique({ where: { businessId: bid }, select: { timezone: true } }),
  ]);

  const tz = settings?.timezone ?? "Europe/Paris";
  const totalDeposits = payments.reduce((s, p) => s + p.amountCents, 0);
  const sortedCounts = [...serviceCounts].sort((a, b) => b._count.serviceId - a._count.serviceId).slice(0, 3);
  const services = await db.service.findMany({ where: { id: { in: sortedCounts.map((c) => c.serviceId) } } });
  const popular = sortedCounts.map((c) => ({
    name: services.find((s) => s.id === c.serviceId)?.name ?? "?", n: c._count.serviceId,
  }));
  const publicUrl = appUrl(`/b/${ctx.business.slug}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ctx.business.name}</h1>
          <p className="text-sm text-muted-foreground">Ton lien public : {publicUrl}</p>
        </div>
        <div className="flex gap-2">
          <CopyButton value={publicUrl} label="Copier mon lien" />
          <Link href={`/b/${ctx.business.slug}`} target="_blank"><Button variant="outline" size="sm">Voir la page</Button></Link>
        </div>
      </div>

      {!["active", "trialing"].includes(ctx.business.subscription_status ?? "") && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <strong>Essai gratuit disponible.</strong> Active ton abonnement DetailDesk Pro
              (14 jours offerts, 29 €/mois ensuite) pour pérenniser ton compte.
            </p>
            <Link href="/dashboard/settings#billing"><Button size="sm">Démarrer l&apos;essai</Button></Link>
          </CardContent>
        </Card>
      )}

      {!ctx.business.stripe_connected && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <strong>Stripe non connecté.</strong> Connecte ton compte pour encaisser des acomptes.
            </p>
            <Link href="/dashboard/settings#stripe"><Button size="sm">Connecter Stripe</Button></Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Prochaines réservations</CardTitle>
            <Link href="/dashboard/bookings"><Button variant="ghost" size="sm">Tout voir →</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState title="Aucune réservation à venir"
                description="Partage ton lien public pour recevoir tes premières réservations." />
            ) : upcoming.map((b) => (
              <Link key={b.id} href={`/dashboard/bookings/${b.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent">
                <div>
                  <p className="text-sm font-medium">{b.customer.fullName} — {b.service.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(b.startsAt.toISOString(), tz)}</p>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Clients récents</CardTitle>
            <Link href="/dashboard/customers"><Button variant="ghost" size="sm">Tout voir →</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentCustomers.length === 0 ? (
              <EmptyState title="Aucun client pour le moment"
                action={<Link href="/dashboard/customers"><Button size="sm">Ajouter un client</Button></Link>} />
            ) : recentCustomers.map((c) => (
              <Link key={c.id} href={`/dashboard/customers/${c.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-accent">
                <p className="text-sm font-medium">{c.fullName}</p>
                <p className="text-xs text-muted-foreground">{c.email ?? ""}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* compact metrics strip — below the actionable content, not a wall of cards */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-background p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Acomptes encaissés</p>
          <p className="text-lg font-semibold">{formatCents(totalDeposits)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">RDV à venir</p>
          <p className="text-lg font-semibold">{upcoming.length}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Services populaires</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {popular.length === 0 ? <span className="text-sm text-muted-foreground">—</span>
              : popular.map((p) => <Badge key={p.name} variant="secondary">{p.name} ×{p.n}</Badge>)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/services"><Button variant="outline">+ Ajouter un service</Button></Link>
        <Link href="/dashboard/bookings"><Button variant="outline">Voir les réservations</Button></Link>
        <Link href="/dashboard/settings#stripe"><Button variant="outline">Stripe</Button></Link>
      </div>
    </div>
  );
}
