"use client";
import { useActionState } from "react";
import { upsertPromotion, togglePromotion } from "../actions";
import { formatCents } from "@/lib/utils";
import { Badge, Button, Input, Label, Select } from "@/components/ui";

type Promo = {
  id: string; code: string; label: string | null; discount_type: string;
  discount_value: number; is_active: boolean; ends_at: string | null;
  usage_limit: number | null; redemptions: number;
};

export function PromoManager({ promos }: { promos: Promo[] }) {
  const [state, formAction, pending] = useActionState(upsertPromotion, null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {promos.length === 0 && <p className="text-sm text-muted-foreground">Aucune promo pour le moment.</p>}
        {promos.map((p) => (
          <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm ${p.is_active ? "" : "opacity-60"}`}>
            <div>
              <p className="font-medium">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono">{p.code}</span>{" "}
                {p.label && <span className="text-muted-foreground">{p.label}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.discount_type === "fixed" ? `${formatCents(p.discount_value)} de remise` : `-${p.discount_value}%`}
                {p.ends_at ? ` · expire le ${new Date(p.ends_at).toLocaleDateString("fr-FR")}` : ""}
                {" · "}{p.redemptions} utilisation(s){p.usage_limit ? ` / ${p.usage_limit}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={p.is_active ? "success" : "muted"}>{p.is_active ? "Active" : "Inactive"}</Badge>
              <form action={togglePromotion}>
                <input type="hidden" name="id" value={p.id} />
                <Button variant="ghost" size="sm" type="submit">{p.is_active ? "Désactiver" : "Activer"}</Button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <form action={formAction} className="space-y-3 border-t pt-4">
        <p className="text-sm font-medium">Nouvelle promo</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Code</Label>
            <Input name="code" required placeholder="BIENVENUE10" className="uppercase" /></div>
          <div className="space-y-1.5"><Label>Libellé (optionnel)</Label>
            <Input name="label" placeholder="Offre de bienvenue" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Type</Label>
            <Select name="discount_type" defaultValue="percent">
              <option value="percent">%</option>
              <option value="fixed">€ fixe</option>
            </Select></div>
          <div className="space-y-1.5"><Label>Valeur</Label>
            <Input name="discount_value" type="number" min={0.01} step="0.01" required placeholder="10" /></div>
          <div className="space-y-1.5"><Label>Limite (0 = ∞)</Label>
            <Input name="usage_limit" type="number" min={0} defaultValue={0} /></div>
        </div>
        <div className="space-y-1.5"><Label>Date d&apos;expiration (optionnel)</Label>
          <Input name="ends_at" type="date" /></div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
        <Button type="submit" disabled={pending}>Créer la promo</Button>
      </form>
    </div>
  );
}
