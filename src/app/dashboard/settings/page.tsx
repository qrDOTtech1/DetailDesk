import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { refreshStripeStatus, connectStripe, toggleSmsReminders, startSubscription, openBillingPortal } from "../actions";
import { getSmsUsage } from "@/lib/sms";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { BusinessSettingsForm, BookingSettingsForm } from "./settings-forms";
import { PromoManager } from "./promo-manager";

async function SmsUsage({ businessId, quota }: { businessId: string; quota: number }) {
  const usage = await getSmsUsage(businessId, quota);
  return (
    <div className="text-sm">
      <p>
        Ce mois-ci : <strong>{usage.sent}</strong> / {usage.quota} SMS inclus
        {usage.overage > 0 && (
          <span className="text-amber-700"> · dépassement {usage.overage} SMS = <strong>{usage.overageEur} €</strong></span>
        )}
      </p>
      <div className="mt-1 h-2 w-48 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${usage.overage > 0 ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${Math.min(100, (usage.sent / usage.quota) * 100)}%` }} />
      </div>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const { stripe: stripeParam } = await searchParams;
  const ctx = await requireBusiness();

  // returning from Stripe onboarding — refresh connection status
  if (stripeParam === "return" && ctx.business.stripe_account_id && !ctx.business.stripe_connected) {
    await refreshStripeStatus();
  }

  const [settings, promos] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id } }),
    db.promotion.findMany({
      where: { businessId: ctx.business.id },
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Réglages</h1>

      <Card id="billing">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Abonnement DetailDesk Pro
            {["active", "trialing"].includes(ctx.business.subscription_status ?? "")
              ? <Badge variant="success">{ctx.business.subscription_status === "trialing" ? "Essai en cours" : "Actif"}</Badge>
              : ctx.business.subscription_status === "past_due"
                ? <Badge variant="warning">Paiement en retard</Badge>
                : <Badge variant="muted">Non abonné</Badge>}
          </CardTitle>
          <CardDescription>
            29 €/mois tout inclus — 14 jours d&apos;essai gratuit, sans engagement.
            150 SMS/mois inclus puis 1 € par tranche de 10 SMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["active", "trialing", "past_due"].includes(ctx.business.subscription_status ?? "") ? (
            <form action={openBillingPortal}>
              <Button type="submit" variant="outline">Gérer mon abonnement (factures, carte, résiliation)</Button>
            </form>
          ) : (
            <form action={startSubscription}>
              <Button type="submit">Démarrer mon essai gratuit de 14 jours</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card id="stripe">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Stripe Connect
            {ctx.business.stripe_connected
              ? <Badge variant="success">Connecté</Badge>
              : <Badge variant="warning">Non connecté</Badge>}
          </CardTitle>
          <CardDescription>
            Les acomptes de tes clients sont encaissés directement sur TON compte Stripe.
            DetailDesk ne touche pas ton argent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={connectStripe}>
            <Button type="submit">
              {ctx.business.stripe_account_id ? "Reprendre / gérer l'onboarding Stripe" : "Connecter mon compte Stripe"}
            </Button>
          </form>
          {ctx.business.stripe_account_id && (
            <form action={refreshStripeStatus}>
              <Button type="submit" variant="outline">Vérifier le statut</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>Slug public : /b/{ctx.business.slug} (non modifiable en V1)</CardDescription>
          </CardHeader>
          <CardContent><BusinessSettingsForm business={ctx.business} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Réservations & rappels</CardTitle>
            <CardDescription>Fuseau horaire, délais et messages.</CardDescription>
          </CardHeader>
          <CardContent>
            <BookingSettingsForm settings={settings ? {
              timezone: settings.timezone,
              reminder_hours_before: settings.reminderHoursBefore,
              booking_notice_hours: settings.bookingNoticeHours,
              buffer_minutes: settings.bufferMinutes,
              confirmation_message: settings.confirmationMessage,
              reminder_message: settings.reminderMessage,
              google_review_url: settings.googleReviewUrl,
              show_public_gallery: settings.showPublicGallery,
            } : null} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Rappels SMS
            {settings?.smsRemindersEnabled
              ? <Badge variant="success">Activés</Badge>
              : <Badge variant="muted">Désactivés</Badge>}
          </CardTitle>
          <CardDescription>
            SMS de rappel automatique 24h avant chaque rendez-vous (en plus de l&apos;email).
            <strong> {settings?.smsQuotaMonthly ?? 150} SMS/mois inclus</strong>, puis 1&nbsp;€ par tranche de 10 SMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <form action={toggleSmsReminders}>
            <Button type="submit" variant={settings?.smsRemindersEnabled ? "outline" : "default"}>
              {settings?.smsRemindersEnabled ? "Désactiver les SMS" : "Activer les rappels SMS"}
            </Button>
          </form>
          <SmsUsage businessId={ctx.business.id} quota={settings?.smsQuotaMonthly ?? 150} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Codes promo</CardTitle>
          <CardDescription>
            Tes clients saisissent le code sur ta page de réservation — la remise s&apos;applique au total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromoManager promos={promos.map((p) => ({
            id: p.id, code: p.code, label: p.label,
            discount_type: p.discountType, discount_value: p.discountValue,
            is_active: p.isActive, ends_at: p.endsAt?.toISOString() ?? null,
            usage_limit: p.usageLimit, redemptions: p._count.redemptions,
          }))} />
        </CardContent>
      </Card>
    </div>
  );
}
