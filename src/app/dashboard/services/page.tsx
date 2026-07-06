import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { ServiceForm, ServiceRowActions } from "./service-form";
import { AddonManager } from "./addon-manager";

const catLabels: Record<string, string> = {
  interior: "Intérieur", exterior: "Extérieur", polish: "Polissage",
  ceramic: "Céramique", restoration: "Rénovation", other: "Autre",
};

export default async function ServicesPage() {
  const ctx = await requireBusiness();
  const services = await db.service.findMany({
    where: { businessId: ctx.business.id }, orderBy: { createdAt: "asc" },
    include: { addons: { where: { isActive: true }, orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Services</h1>
        {services.length === 0 ? (
          <EmptyState title="Aucun service" description="Ajoute ton premier service avec le formulaire ci-contre." />
        ) : (
          services.map((s) => (
            <Card key={s.id} className={s.isActive ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{s.name} {!s.isActive && <Badge variant="muted">Inactif</Badge>}</p>
                  <p className="text-sm text-muted-foreground">
                    {catLabels[s.category]} · {formatCents(s.priceCents)} · {s.durationMinutes} min
                    {s.depositRequired && (
                      <> · acompte {s.depositType === "fixed" ? formatCents(s.depositValue) : `${s.depositValue}%`}</>
                    )}
                  </p>
                </div>
                <ServiceRowActions service={{
                  id: s.id, name: s.name, description: s.description, category: s.category,
                  price_cents: s.priceCents, duration_minutes: s.durationMinutes,
                  deposit_required: s.depositRequired, deposit_type: s.depositType,
                  deposit_value: s.depositValue, is_active: s.isActive,
                  rebook_after_days: s.rebookAfterDays,
                }} />
                <AddonManager serviceId={s.id}
                  addons={s.addons.map((a) => ({ id: a.id, name: a.name, price_cents: a.priceCents }))} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Card className="h-fit">
        <CardHeader><CardTitle>Nouveau service</CardTitle></CardHeader>
        <CardContent><ServiceForm /></CardContent>
      </Card>
    </div>
  );
}
