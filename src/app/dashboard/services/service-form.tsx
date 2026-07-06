"use client";
import { useActionState, useState } from "react";
import { upsertService, deleteService } from "../actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type Service = {
  id: string; name: string; description: string | null; category: string;
  price_cents: number; duration_minutes: number; deposit_required: boolean;
  deposit_type: string; deposit_value: number; is_active: boolean;
  rebook_after_days: number | null;
};

export function ServiceForm({ service, onDone }: { service?: Service; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const r = await upsertService(prev as null, fd);
      if (r?.success) onDone?.();
      return r;
    }, null);
  const [depositRequired, setDepositRequired] = useState(service?.deposit_required ?? false);

  return (
    <form action={formAction} className="space-y-3">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="space-y-1.5">
        <Label>Nom</Label>
        <Input name="name" required defaultValue={service?.name} placeholder="Detailing intérieur complet" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea name="description" defaultValue={service?.description ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Catégorie</Label>
          <Select name="category" defaultValue={service?.category ?? "interior"}>
            <option value="interior">Intérieur</option>
            <option value="exterior">Extérieur</option>
            <option value="polish">Polissage</option>
            <option value="ceramic">Céramique</option>
            <option value="restoration">Rénovation</option>
            <option value="other">Autre</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Durée (min)</Label>
          <Input name="duration_minutes" type="number" min={15} step={15} required
            defaultValue={service?.duration_minutes ?? 60} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Prix (€)</Label>
        <Input name="price_euros" type="number" min={0} step="0.01" required
          defaultValue={service ? service.price_cents / 100 : ""} placeholder="89" />
      </div>
      <div className="flex items-center gap-2">
        <input id={`dep-${service?.id ?? "new"}`} type="checkbox" name="deposit_required"
          defaultChecked={depositRequired} onChange={(e) => setDepositRequired(e.target.checked)} />
        <Label htmlFor={`dep-${service?.id ?? "new"}`}>Acompte requis</Label>
      </div>
      {depositRequired && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type d&apos;acompte</Label>
            <Select name="deposit_type" defaultValue={service?.deposit_type ?? "fixed"}>
              <option value="fixed">Montant fixe (€)</option>
              <option value="percent">Pourcentage (%)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valeur (€ ou %)</Label>
            <Input name="deposit_value" type="number" min={0} step="0.01"
              defaultValue={service
                ? (service.deposit_type === "fixed" ? service.deposit_value / 100 : service.deposit_value)
                : 0} />
          </div>
        </div>
      )}
      {!depositRequired && (
        <>
          <input type="hidden" name="deposit_type" value={service?.deposit_type ?? "fixed"} />
          <input type="hidden" name="deposit_value" value={service?.deposit_value ?? 0} />
        </>
      )}
      <div className="space-y-1.5">
        <Label>Relance de rebooking automatique</Label>
        <Select name="rebook_after_days" defaultValue={String(service?.rebook_after_days ?? 0)}>
          <option value="0">Désactivée</option>
          <option value="30">30 jours après la prestation</option>
          <option value="60">60 jours après</option>
          <option value="90">90 jours après</option>
          <option value="180">6 mois après</option>
        </Select>
        <p className="text-xs text-muted-foreground">
          Le client reçoit un email &quot;il est temps de reprendre RDV&quot; avec ton lien de réservation.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input id={`act-${service?.id ?? "new"}`} type="checkbox" name="is_active" defaultChecked={service?.is_active ?? true} />
        <Label htmlFor={`act-${service?.id ?? "new"}`}>Actif (visible sur la page publique)</Label>
      </div>
      {(state as { error?: string } | null)?.error && (
        <p className="text-sm text-destructive">{(state as { error?: string }).error}</p>
      )}
      {(state as { success?: string } | null)?.success && (
        <p className="text-sm text-emerald-600">{(state as { success?: string }).success}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "…" : service ? "Enregistrer" : "Ajouter le service"}
      </Button>
    </form>
  );
}

export function ServiceRowActions({ service }: { service: Service }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="w-full sm:w-auto">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Fermer" : "Modifier"}
        </Button>
        <form action={deleteService}>
          <input type="hidden" name="id" value={service.id} />
          <Button variant="ghost" size="sm" type="submit">Désactiver</Button>
        </form>
      </div>
      {editing && (
        <div className="mt-4 w-full rounded-md border p-4 sm:w-[360px]">
          <ServiceForm service={service} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
