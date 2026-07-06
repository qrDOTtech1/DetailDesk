import Link from "next/link";
import { requirePortalCustomer } from "@/lib/portal-auth";
import { db } from "@/lib/db";
import { formatCents, formatDateTime } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { MakeLogo } from "@/components/vehicle-picker";
import { portalSignOut, setPortalConsent } from "./actions";
import { ThemeToggle } from "@/components/theme-toggle";

function loyaltyLabel(completed: number, isVip: boolean) {
  if (isVip) return { label: "Client VIP ⭐", variant: "success" };
  if (completed >= 5) return { label: "Client fidèle", variant: "success" };
  if (completed >= 2) return { label: "Client régulier", variant: "secondary" };
  return { label: "Bienvenue !", variant: "muted" };
}

export default async function PortalPage() {
  const customer = await requirePortalCustomer();
  const now = new Date();

  const [bookings, vehicles, photos, consent, settings, promos] = await Promise.all([
    db.booking.findMany({
      where: { customerId: customer.id, businessId: customer.businessId },
      include: { service: true, vehicle: true },
      orderBy: { startsAt: "desc" }, take: 50,
    }),
    db.vehicle.findMany({ where: { customerId: customer.id, businessId: customer.businessId } }),
    db.bookingPhoto.findMany({
      where: {
        businessId: customer.businessId,
        OR: [
          { customerId: customer.id },
          { booking: { customerId: customer.id } },
          { vehicle: { customerId: customer.id } },
        ],
      },
      select: { id: true, kind: true, caption: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 40,
    }),
    db.customerConsent.findUnique({
      where: { customerId_consentType: { customerId: customer.id, consentType: "public_photos" } },
    }),
    db.businessSettings.findUnique({ where: { businessId: customer.businessId }, select: { timezone: true } }),
    db.promotion.findMany({
      where: {
        businessId: customer.businessId, isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      take: 3,
    }),
  ]);

  const tz = settings?.timezone ?? "Europe/Paris";
  const upcoming = bookings.filter((b) => b.startsAt >= now && ["pending", "confirmed"].includes(b.status));
  const past = bookings.filter((b) => b.startsAt < now || !["pending", "confirmed"].includes(b.status));
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const loyalty = loyaltyLabel(completedCount, customer.isVip);
  const biz = customer.business;

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {biz.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={biz.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            )}
            <span className="font-semibold">{biz.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <form action={portalSignOut}><Button variant="ghost" size="sm">Déconnexion</Button></form>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Bonjour {customer.fullName.split(" ")[0]} 👋</h1>
            <Badge variant={loyalty.variant}>{loyalty.label}</Badge>
          </div>
          <Link href={`/b/${biz.slug}`}>
            <Button>Reprendre rendez-vous</Button>
          </Link>
        </div>

        {promos.length > 0 && (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="p-4 text-sm">
              {promos.map((p) => (
                <p key={p.id}>
                  🎁 <strong>{p.label || "Promo"}</strong> — code <strong>{p.code}</strong> :{" "}
                  {p.discountType === "fixed" ? `${formatCents(p.discountValue)} de remise` : `-${p.discountValue}%`}
                  {p.endsAt ? ` (jusqu'au ${formatDateTime(p.endsAt.toISOString(), tz)})` : ""}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Prochains rendez-vous</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun rendez-vous prévu. <Link href={`/b/${biz.slug}`} className="underline">Réserver un créneau</Link>
              </p>
            ) : upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{b.service.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(b.startsAt.toISOString(), tz)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span>{formatCents(b.totalPriceCents)}</span>
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mes véhicules</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {vehicles.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-md border p-3">
                <MakeLogo make={v.make} className="h-10 w-10" />
                <div className="text-sm">
                  <p className="font-medium">{v.make} {v.model}</p>
                  <p className="text-xs text-muted-foreground">
                    {[v.trim, v.year, v.plate].filter(Boolean).join(" · ") || " "}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {photos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Photos de mes prestations</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <figure key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${p.id}`} alt={p.caption ?? p.kind}
                      className="aspect-square w-full rounded-md border object-cover" />
                    <figcaption className="mt-0.5 text-center text-[11px] text-muted-foreground">
                      {p.kind === "before" ? "Avant" : p.kind === "after" ? "Après" : p.caption ?? ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {past.length === 0 ? <p className="text-sm text-muted-foreground">—</p> :
              past.slice(0, 10).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">{b.service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(b.startsAt.toISOString(), tz)}
                      {b.vehicle ? ` · ${b.vehicle.make} ${b.vehicle.model}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mes photos et la galerie publique</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {biz.name} peut présenter des photos avant/après de tes prestations dans sa galerie
              publique, uniquement avec ton accord. Tu peux changer d&apos;avis à tout moment.
            </p>
            <form action={setPortalConsent}>
              <input type="hidden" name="granted" value={consent?.granted ? "false" : "true"} />
              <Button type="submit" variant={consent?.granted ? "outline" : "default"} size="sm">
                {consent?.granted ? "Retirer mon accord" : "Donner mon accord"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Statut actuel : {consent?.granted ? "accord donné ✅" : "pas d'accord — aucune photo publiée"}
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {[biz.phone, biz.email].filter(Boolean).join(" · ")}
        </p>
      </div>
    </main>
  );
}
