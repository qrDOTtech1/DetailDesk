"use client";
import { useActionState } from "react";
import { sendInvoiceEmail } from "../actions";
import { Button } from "@/components/ui";

export function SendInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState(sendInvoiceEmail, null);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={invoiceId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer par email"}
      </Button>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-600">{state.success}</p>}
    </form>
  );
}
