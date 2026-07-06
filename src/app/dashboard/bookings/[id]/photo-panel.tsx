"use client";
import { useActionState } from "react";
import { uploadBookingPhoto, deleteBookingPhoto } from "../../actions";
import { Button, Card, CardContent, CardHeader, CardTitle, Label, Select } from "@/components/ui";

type Photo = { id: string; kind: "before" | "after" };

export function PhotoPanel({ bookingId, photos }: { bookingId: string; photos: Photo[] }) {
  const [state, formAction, pending] = useActionState(uploadBookingPhoto, null);
  const before = photos.filter((p) => p.kind === "before");
  const after = photos.filter((p) => p.kind === "after");

  const Gallery = ({ title, items }: { title: string; items: Photo[] }) => (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((p) => (
            <div key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}`} alt={title}
                className="aspect-square w-full rounded-md border object-cover" />
              <form action={deleteBookingPhoto} className="absolute right-1 top-1 opacity-0 group-hover:opacity-100">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" title="Supprimer"
                  className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">×</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Photos avant / après</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Gallery title="Avant" items={before} />
        <Gallery title="Après" items={after} />
        <form action={formAction} className="space-y-2 border-t pt-3">
          <input type="hidden" name="booking_id" value={bookingId} />
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Photo (JPEG/PNG/WebP, max 2 Mo)</Label>
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required
                className="block w-full text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1 file:text-xs" />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Type</Label>
              <Select name="kind" defaultValue="before">
                <option value="before">Avant</option>
                <option value="after">Après</option>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "…" : "Ajouter"}</Button>
          </div>
          {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
          {state?.success && <p className="text-xs text-emerald-600">{state.success}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
