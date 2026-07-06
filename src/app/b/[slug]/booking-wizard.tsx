"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { getAvailableSlots, createPublicBooking } from "./actions";
import { computeDeposit, formatCents } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";
import { VehiclePicker } from "@/components/vehicle-picker";

type Addon = { id: string; name: string; price_cents: number };
type Service = {
  id: string; name: string; description: string | null; category: string;
  price_cents: number; duration_minutes: number;
  deposit_required: boolean; deposit_type: "fixed" | "percent"; deposit_value: number;
  addons: Addon[];
};

export function BookingWizard({ slug, services, stripeConnected, cancellationPolicy, prefill }: {
  slug: string; services: Service[]; stripeConnected: boolean; cancellationPolicy: string | null;
  prefill?: { name?: string; email?: string; phone?: string; make?: string; model?: string };
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [service, setService] = React.useState<Service | null>(null);
  const [date, setDate] = React.useState("");
  const [slots, setSlots] = React.useState<string[]>([]);
  const [tz, setTz] = React.useState("Europe/Paris");
  const [slot, setSlot] = React.useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const deposit = service ? computeDeposit(service) : 0;
  const depositActive = deposit > 0 && stripeConnected;
  const addonsTotal = service
    ? service.addons.filter((a) => selectedAddons.includes(a.id)).reduce((s, a) => s + a.price_cents, 0)
    : 0;
  const total = (service?.price_cents ?? 0) + addonsTotal;

  async function loadSlots(d: string, s: Service) {
    setLoading(true); setError(null); setSlots([]); setSlot(null);
    const res = await getAvailableSlots(slug, s.id, d);
    setLoading(false);
    if ("error" in res && res.error) { setError(res.error); return; }
    const r = res as { slots: string[]; timezone: string };
    setSlots(r.slots); setTz(r.timezone);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!service || !slot) return;
    setLoading(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createPublicBooking(slug, {
      service_id: service.id,
      addon_ids: selectedAddons,
      starts_at: slot,
      customer_name: fd.get("customer_name"),
      customer_email: fd.get("customer_email"),
      customer_phone: fd.get("customer_phone") ?? "",
      vehicle_make: fd.get("vehicle_make"),
      vehicle_model: fd.get("vehicle_model"),
      vehicle_trim: fd.get("vehicle_trim") ?? "",
      vehicle_year: fd.get("vehicle_year") || "",
      vehicle_size: fd.get("vehicle_size") || "other",
      notes: fd.get("notes") ?? "",
      promo_code: fd.get("promo_code") ?? "",
      consent_public_photos: fd.get("consent_public_photos") === "on",
    });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    if ("checkoutUrl" in res && res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
    router.push(`/b/${slug}/confirmed/${res.bookingId}`);
  }

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));

  return (
    <div className="space-y-4">
      {/* Step 1: service */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Choisis ton service</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {services.length === 0 && <p className="text-sm text-muted-foreground">Aucun service disponible pour le moment.</p>}
          {services.map((s) => (
            <button key={s.id} type="button"
              onClick={() => { setService(s); setSelectedAddons([]); setStep(2); if (date) loadSlots(date, s); }}
              className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-accent ${service?.id === s.id ? "border-primary ring-1 ring-primary" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.name}</p>
                <p className="font-semibold">{formatCents(s.price_cents)}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {s.duration_minutes} min
                {s.deposit_required && stripeConnected && (
                  <> · acompte {s.deposit_type === "fixed" ? formatCents(s.deposit_value) : `${s.deposit_value}%`}</>
                )}
              </p>
              {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Step 1b: add-ons */}
      {step >= 2 && service && service.addons.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Options supplémentaires</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {service.addons.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm hover:bg-accent">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedAddons.includes(a.id)}
                    onChange={(e) => setSelectedAddons((prev) =>
                      e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id))} />
                  {a.name}
                </span>
                <span className="font-medium">+{formatCents(a.price_cents)}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 2: date + slot */}
      {step >= 2 && service && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Choisis ton créneau</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="date" value={date} min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { setDate(e.target.value); if (e.target.value) loadSlots(e.target.value, service); }} />
            {loading && <p className="text-sm text-muted-foreground">Recherche des créneaux…</p>}
            {!loading && date && slots.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun créneau disponible ce jour-là.</p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <Button key={s} type="button" size="sm"
                  variant={slot === s ? "default" : "outline"}
                  onClick={() => { setSlot(s); setStep(3); }}>
                  {fmtTime(s)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: infos */}
      {step >= 3 && service && slot && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Tes infos</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Nom complet</Label>
                  <Input name="customer_name" required defaultValue={prefill?.name ?? ""} /></div>
                <div className="space-y-1.5"><Label>Email</Label>
                  <Input name="customer_email" type="email" required defaultValue={prefill?.email ?? ""} /></div>
              </div>
              <div className="space-y-1.5"><Label>Téléphone</Label>
                <Input name="customer_phone" defaultValue={prefill?.phone ?? ""} /></div>

              <VehiclePicker namePrefix="vehicle_"
                defaultMake={prefill?.make ?? ""} defaultModel={prefill?.model ?? ""} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Année (optionnel)</Label>
                  <Input name="vehicle_year" type="number" min={1950} max={2035} /></div>
                <div className="space-y-1.5">
                  <Label>Gabarit</Label>
                  <Select name="vehicle_size" defaultValue="sedan">
                    <option value="compact">Citadine</option><option value="sedan">Berline</option>
                    <option value="suv">SUV</option><option value="truck">Pickup</option>
                    <option value="van">Van</option><option value="other">Autre</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Code promo (optionnel)</Label>
                <Input name="promo_code" placeholder="BIENVENUE10" className="uppercase" />
              </div>
              <div className="space-y-1.5"><Label>Notes (optionnel)</Label>
                <Textarea name="notes" placeholder="État du véhicule, demandes particulières…" /></div>

              <div className="rounded-md bg-muted p-3 text-sm">
                <p><strong>{service.name}</strong> — {formatCents(service.price_cents)}</p>
                {addonsTotal > 0 && (
                  <p>Options : +{formatCents(addonsTotal)} → total <strong>{formatCents(total)}</strong></p>
                )}
                {depositActive
                  ? <p>Acompte à régler maintenant : <strong>{formatCents(deposit)}</strong> (reste {formatCents(total - deposit)} sur place)</p>
                  : <p>Paiement sur place.</p>}
                {cancellationPolicy && <p className="mt-1 text-xs text-muted-foreground">{cancellationPolicy}</p>}
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="consent_public_photos" className="mt-0.5" />
                <span>
                  J&apos;accepte que des photos avant/après de mon véhicule puissent être utilisées
                  dans la galerie publique du professionnel. (Optionnel, révocable à tout moment.)
                </span>
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "…" : depositActive ? `Réserver et payer l'acompte (${formatCents(deposit)})` : "Confirmer la réservation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
