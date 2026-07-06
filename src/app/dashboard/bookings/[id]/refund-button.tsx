"use client";
import { useActionState } from "react";
import { refundDeposit } from "../../actions";
import { Button } from "@/components/ui";

export function RefundButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(refundDeposit, null);
  if (state?.success) return <p className="text-sm text-emerald-600">{state.success}</p>;
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="booking_id" value={bookingId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}
        onClick={(e) => { if (!confirm("Rembourser intégralement l'acompte au client ?")) e.preventDefault(); }}>
        {pending ? "Remboursement…" : "Rembourser l'acompte"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
