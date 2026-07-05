import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/utils";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { ServiceForm, ServiceRowActions } from "./service-form";

const catLabels: Record<string, string> = {
  interior: "Intérieur", exterior: "Extérieur", polish: "Polissage",
  ceramic: "Céramique", restoration: "Rénovation", other: "Autre",
};

export default async function ServicesPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { data: services } = await supabase.from("services")
    .select("*").eq("business_id", ctx.business.id).order("created_at");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Services</h1>
        {(services ?? []).length === 0 ? (
          <EmptyState title="Aucun service" description="Ajoute ton premier service avec le formulaire ci-contre." />
        ) : (
          services!.map((s) => (
            <Card key={s.id} className={s.is_active ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{s.name} {!s.is_active && <Badge variant="muted">Inactif</Badge>}</p>
                  <p className="text-sm text-muted-foreground">
                    {catLabels[s.category]} · {formatCents(s.price_cents)} · {s.duration_minutes} min
                    {s.deposit_required && (
                      <> · acompte {s.deposit_type === "fixed" ? formatCents(s.deposit_value) : `${s.deposit_value}%`}</>
                    )}
                  </p>
                </div>
                <ServiceRowActions service={s} />
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
