"use client";
import { useActionState, useState } from "react";
import { rescheduleBooking } from "../../actions";
import { Button, Input } from "@/components/ui";

export function RescheduleForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(rescheduleBooking, null);

  if (!open) {
    return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Reprogrammer</Button>;
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={bookingId} />
      <Input name="starts_at" type="datetime-local" required className="w-56" />
      <Button type="submit" size="sm" disabled={pending}>{pending ? "…" : "Déplacer"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-emerald-600">{state.success}</p>}
    </form>
  );
}
