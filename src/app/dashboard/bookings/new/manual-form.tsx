"use client";
import { useActionState, useState } from "react";
import { createManualBooking } from "../../actions";
import { formatCents } from "@/lib/utils";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export function ManualBookingForm({ services, customers }: {
  services: { id: string; name: string; price_cents: number; duration: number }[];
  customers: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(createManualBooking, null);
  const [mode, setMode] = useState<"existing" | "new">(customers.length > 0 ? "existing" : "new");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Service</Label>
        <Select name="service_id" required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatCents(s.price_cents)} ({s.duration} min)
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Client</Label>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={() => setMode("existing")}
            className={`rounded-md border px-3 py-1.5 ${mode === "existing" ? "border-primary bg-accent font-medium" : ""}`}
            disabled={customers.length === 0}>
            Client existant
          </button>
          <button type="button" onClick={() => setMode("new")}
            className={`rounded-md border px-3 py-1.5 ${mode === "new" ? "border-primary bg-accent font-medium" : ""}`}>
            Nouveau client
          </button>
        </div>
      </div>

      {mode === "existing" ? (
        <div className="space-y-1.5">
          <Select name="customer_id" required>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nom complet</Label>
            <Input name="customer_name" required placeholder="Karim Benali" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email (optionnel)</Label>
              <Input name="customer_email" type="email" /></div>
            <div className="space-y-1.5"><Label>Téléphone (optionnel)</Label>
              <Input name="customer_phone" /></div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Date et heure</Label>
        <Input name="starts_at" type="datetime-local" required />
      </div>
      <div className="space-y-1.5">
        <Label>Notes (optionnel)</Label>
        <Textarea name="notes" placeholder="Demande reçue par WhatsApp…" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : "Créer la réservation"}
      </Button>
    </form>
  );
}
