"use client";
import { useActionState } from "react";
import {
  updateBusinessProfile, uploadBusinessBrandPhoto, uploadGalleryPhoto, deleteBusinessPhoto,
} from "../actions";
import { Button, Input, Label, Textarea } from "@/components/ui";

type Profile = { description: string | null; siret: string | null; vat_number: string | null };
type GalleryPhoto = { id: string; caption: string | null };

export function ShopProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateBusinessProfile, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Description de l&apos;atelier</Label>
        <Textarea name="description" rows={4} defaultValue={profile.description ?? ""}
          placeholder="Ce qui te distingue : expérience, spécialités, matériel, valeurs…" />
        <p className="text-xs text-muted-foreground">Affichée sur ta page de réservation publique.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>SIRET (optionnel)</Label>
          <Input name="siret" defaultValue={profile.siret ?? ""} placeholder="123 456 789 00012" /></div>
        <div className="space-y-1.5"><Label>N° TVA (optionnel)</Label>
          <Input name="vat_number" defaultValue={profile.vat_number ?? ""} placeholder="FR12345678900" />
          <p className="text-xs text-muted-foreground">Vide = mention &quot;TVA non applicable, art. 293 B du CGI&quot; sur tes factures.</p>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" disabled={pending}>Enregistrer</Button>
    </form>
  );
}

function BrandPhotoUpload({ kind, current, label, hint }: {
  kind: "logo" | "cover"; current: string | null; label: string; hint: string;
}) {
  const [state, formAction, pending] = useActionState(uploadBusinessBrandPhoto, null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt={label}
          className={kind === "logo" ? "h-16 w-16 rounded-full border object-cover" : "h-24 w-full rounded-md border object-cover"} />
      )}
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required
          className="block flex-1 text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs" />
        <Button type="submit" size="sm" disabled={pending}>{pending ? "…" : "Envoyer"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-600">{state.success}</p>}
    </div>
  );
}

export function LogoCoverUpload({ logoUrl, coverUrl }: { logoUrl: string | null; coverUrl: string | null }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <BrandPhotoUpload kind="logo" current={logoUrl} label="Logo" hint="Carré de préférence, max 2 Mo." />
      <BrandPhotoUpload kind="cover" current={coverUrl} label="Photo de couverture" hint="Format large, max 5 Mo." />
    </div>
  );
}

export function GalleryManager({ photos }: { photos: GalleryPhoto[] }) {
  const [state, formAction, pending] = useActionState(uploadGalleryPhoto, null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/business-photos/${p.id}`} alt={p.caption ?? "Atelier"}
              className="aspect-square w-full rounded-md border object-cover" />
            <form action={deleteBusinessPhoto} className="absolute right-1 top-1 opacity-0 group-hover:opacity-100">
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">×</button>
            </form>
          </div>
        ))}
        {photos.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Aucune photo pour le moment.</p>}
      </div>
      <form action={formAction} className="flex items-center gap-2">
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required
          className="block flex-1 text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs" />
        <Input name="caption" placeholder="Légende (optionnel)" className="h-8 w-40 text-xs" />
        <Button type="submit" size="sm" disabled={pending}>{pending ? "…" : "Ajouter"}</Button>
      </form>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <p className="text-xs text-muted-foreground">Jusqu&apos;à 20 photos, visibles sur ta page de réservation publique.</p>
    </div>
  );
}
