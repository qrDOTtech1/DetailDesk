"use client";
import { useActionState, useMemo, useState } from "react";
import { createInvoice } from "../actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type Customer = { id: string; label: string };
type Booking = { id: string; customerId: string; label: string };

export function NewInvoiceForm({ customers, bookings, preselect }: {
  customers: Customer[]; bookings: Booking[]; preselect?: { customerId: string; bookingId: string };
}) {
  const [state, formAction, pending] = useActionState(createInvoice, null);
  const [customerId, setCustomerId] = useState(preselect?.customerId ?? customers[0]?.id ?? "");
  const [bookingId, setBookingId] = useState(preselect?.bookingId ?? "");
  const [lineCount, setLineCount] = useState(1);

  const customerBookings = useMemo(
    () => bookings.filter((b) => b.customerId === customerId),
    [bookings, customerId]
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Client</Label>
        <Select value={customerId} name="customer_id"
          onChange={(e) => { setCustomerId(e.target.value); setBookingId(""); }} required>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Réservation (optionnel — pré-remplit les lignes)</Label>
        <Select value={bookingId} name="booking_id" onChange={(e) => setBookingId(e.target.value)}>
          <option value="">— Lignes libres —</option>
          {customerBookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </Select>
      </div>

      {!bookingId && (
        <div className="space-y-2">
          <Label>Lignes</Label>
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Input name={`description_${i}`} placeholder="Description" className="flex-1" required={i === 0} />
              <Input name={`quantity_${i}`} type="number" min={1} defaultValue={1} className="w-16" />
              <Input name={`unit_price_${i}`} type="number" min={0} step="0.01" placeholder="Prix €" className="w-24" />
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLineCount((n) => n + 1)}>
            + Ajouter une ligne
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>TVA (%, 0 si exonéré)</Label>
          <Input name="tax_rate_percent" type="number" min={0} max={100} defaultValue={0} /></div>
        <div className="space-y-1.5"><Label>Échéance (optionnel)</Label>
          <Input name="due_date" type="date" /></div>
      </div>
      <div className="space-y-1.5"><Label>Notes (optionnel)</Label>
        <Textarea name="notes" placeholder="Modalités de paiement, remerciements…" /></div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : "Créer le brouillon"}
      </Button>
    </form>
  );
}
