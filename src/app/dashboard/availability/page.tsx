import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { AvailabilityForms, RuleDeleteButton, SlotDeleteButton } from "./availability-forms";

const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default async function AvailabilityPage() {
  const ctx = await requireBusiness();
  const [rules, blocked, settings] = await Promise.all([
    db.availabilityRule.findMany({
      where: { businessId: ctx.business.id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    db.blockedSlot.findMany({
      where: { businessId: ctx.business.id, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" },
    }),
    db.businessSettings.findUnique({ where: { businessId: ctx.business.id }, select: { timezone: true } }),
  ]);
  const tz = settings?.timezone ?? "Europe/Paris";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Disponibilités</h1>
          <p className="text-sm text-muted-foreground">Horaires hebdomadaires et périodes bloquées (fuseau : {tz}).</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Horaires hebdomadaires</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rules.length === 0 ? <EmptyState title="Aucun horaire défini" /> :
              rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span><strong>{days[r.weekday]}</strong> — {r.startTime.slice(0, 5)} → {r.endTime.slice(0, 5)}</span>
                  <RuleDeleteButton id={r.id} />
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Périodes bloquées</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {blocked.length === 0 ? <EmptyState title="Aucune période bloquée" /> :
              blocked.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>{formatDateTime(s.startsAt.toISOString(), tz)} → {formatDateTime(s.endsAt.toISOString(), tz)} {s.reason ? `· ${s.reason}` : ""}</span>
                  <SlotDeleteButton id={s.id} />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
      <AvailabilityForms />
    </div>
  );
}
