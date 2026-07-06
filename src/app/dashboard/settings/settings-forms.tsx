"use client";
import { useActionState } from "react";
import { updateBusiness, updateSettings } from "../actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type Business = {
  name: string; email: string; phone: string | null; address: string | null;
  business_type: string; logo_url: string | null; cancellation_policy: string | null;
};
type Settings = {
  timezone: string; reminder_hours_before: number; booking_notice_hours: number;
  buffer_minutes: number; confirmation_message: string | null; reminder_message: string | null;
  google_review_url: string | null;
  show_public_gallery: boolean;
} | null;

export function BusinessSettingsForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState(updateBusiness, null);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5"><Label>Nom</Label><Input name="name" required defaultValue={business.name} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required defaultValue={business.email} /></div>
        <div className="space-y-1.5"><Label>Téléphone</Label><Input name="phone" defaultValue={business.phone ?? ""} /></div>
      </div>
      <div className="space-y-1.5"><Label>Adresse</Label><Input name="address" defaultValue={business.address ?? ""} /></div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select name="business_type" defaultValue={business.business_type}>
          <option value="studio">Studio</option><option value="mobile">Mobile</option><option value="both">Les deux</option>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Logo (URL)</Label><Input name="logo_url" defaultValue={business.logo_url ?? ""} /></div>
      <div className="space-y-1.5"><Label>Politique d&apos;annulation</Label>
        <Textarea name="cancellation_policy" defaultValue={business.cancellation_policy ?? ""} /></div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" disabled={pending}>Enregistrer</Button>
    </form>
  );
}

export function BookingSettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateSettings, null);
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5"><Label>Fuseau horaire (IANA)</Label>
        <Input name="timezone" required defaultValue={settings?.timezone ?? "Europe/Paris"} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5"><Label>Rappel (h avant)</Label>
          <Input name="reminder_hours_before" type="number" min={1} defaultValue={settings?.reminder_hours_before ?? 24} /></div>
        <div className="space-y-1.5"><Label>Préavis mini (h)</Label>
          <Input name="booking_notice_hours" type="number" min={0} defaultValue={settings?.booking_notice_hours ?? 12} /></div>
        <div className="space-y-1.5"><Label>Buffer (min)</Label>
          <Input name="buffer_minutes" type="number" min={0} defaultValue={settings?.buffer_minutes ?? 15} /></div>
      </div>
      <div className="space-y-1.5"><Label>Message de confirmation (optionnel)</Label>
        <Textarea name="confirmation_message" defaultValue={settings?.confirmation_message ?? ""} /></div>
      <div className="space-y-1.5"><Label>Message de rappel (optionnel)</Label>
        <Textarea name="reminder_message" defaultValue={settings?.reminder_message ?? ""} /></div>
      <div className="space-y-1.5">
        <Label>Lien avis Google (optionnel)</Label>
        <Input name="google_review_url" type="url" placeholder="https://g.page/r/…/review"
          defaultValue={settings?.google_review_url ?? ""} />
        <p className="text-xs text-muted-foreground">
          Si renseigné, tes clients reçoivent automatiquement une demande d&apos;avis après chaque prestation terminée.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <input id="show_public_gallery" type="checkbox" name="show_public_gallery"
          defaultChecked={settings?.show_public_gallery ?? false} className="mt-0.5" />
        <div>
          <Label htmlFor="show_public_gallery">Galerie publique &quot;Nos réalisations&quot;</Label>
          <p className="text-xs text-muted-foreground">
            Affiche sur ta page de réservation les photos que tu as marquées publiques,
            uniquement pour les clients ayant donné leur accord.
          </p>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" disabled={pending}>Enregistrer</Button>
    </form>
  );
}
