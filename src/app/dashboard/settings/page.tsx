import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { refreshStripeStatus, connectStripe } from "../actions";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { BusinessSettingsForm, BookingSettingsForm } from "./settings-forms";
import { PromoManager } from "./promo-manager";

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
