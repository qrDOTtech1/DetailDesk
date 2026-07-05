"use client";
import { useActionState, useState } from "react";
import { upsertService, deleteService } from "../actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type Service = {
  id: string; name: string; description: string | null; category: string;
  price_cents: number; duration_minutes: number; deposit_required: boolean;
  deposit_type: string; deposit_value: number; is_active: boolean;
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
        <Label>Prix (centimes — ex. 8900 = 89,00 €)</Label>
        <Input name="price_cents" type="number" min={0} required defaultValue={service?.price_cents ?? 0} />
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
              <option value="fixed">Montant fixe (centimes)</option>
              <option value="percent">Pourcentage</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valeur</Label>
            <Input name="deposit_value" type="number" min={0} defaultValue={service?.deposit_value ?? 0} />
          </div>
        </div>
      )}
      {!depositRequired && (
        <>
          <input type="hidden" name="deposit_type" value={service?.deposit_type ?? "fixed"} />
          <input type="hidden" name="deposit_value" value={service?.deposit_value ?? 0} />
        </>
      )}
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
