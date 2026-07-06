"use client";
import { useActionState } from "react";
import { upsertCustomer, upsertVehicle } from "../actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { VehiclePicker } from "@/components/vehicle-picker";

type Customer = { id: string; full_name: string; email: string | null; phone: string | null; notes: string | null };

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, formAction, pending] = useActionState(upsertCustomer, null);
  return (
    <form action={formAction} className="space-y-3">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <div className="space-y-1.5"><Label>Nom complet</Label>
        <Input name="full_name" required defaultValue={customer?.full_name} /></div>
      <div className="space-y-1.5"><Label>Email</Label>
        <Input name="email" type="email" defaultValue={customer?.email ?? ""} /></div>
      <div className="space-y-1.5"><Label>Téléphone</Label>
        <Input name="phone" defaultValue={customer?.phone ?? ""} /></div>
      <div className="space-y-1.5"><Label>Notes</Label>
        <Textarea name="notes" defaultValue={customer?.notes ?? ""} /></div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "…" : customer ? "Enregistrer" : "Ajouter le client"}
      </Button>
    </form>
  );
}

export function VehicleForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(upsertVehicle, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <VehiclePicker namePrefix="" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Année</Label><Input name="year" type="number" min={1950} max={2035} /></div>
        <div className="space-y-1.5"><Label>Plaque</Label><Input name="plate" placeholder="AB-123-CD" /></div>
      </div>
      <div className="space-y-1.5">
        <Label>Gabarit</Label>
        <Select name="size_category" defaultValue="sedan">
          <option value="compact">Citadine</option>
          <option value="sedan">Berline</option>
          <option value="suv">SUV</option>
          <option value="truck">Pickup</option>
          <option value="van">Van / utilitaire</option>
          <option value="other">Autre</option>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Notes</Label><Textarea name="notes" /></div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "…" : "Ajouter le véhicule"}</Button>
    </form>
  );
}
