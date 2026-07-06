"use client";
import { useActionState, useState } from "react";
import { upsertAddon, deleteAddon } from "../actions";
import { formatCents } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

type Addon = { id: string; name: string; price_cents: number };

export function AddonManager({ serviceId, addons }: { serviceId: string; addons: Addon[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(upsertAddon, null);

  return (
    <div className="mt-2 w-full border-t pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Options :</span>
        {addons.length === 0 && <span className="text-xs text-muted-foreground">aucune</span>}
        {addons.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
            {a.name} +{formatCents(a.price_cents)}
            <form action={deleteAddon} className="inline">
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" className="ml-0.5 text-muted-foreground hover:text-destructive" title="Supprimer">×</button>
            </form>
          </span>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer" : "+ Option"}
        </Button>
      </div>
      {open && (
        <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="service_id" value={serviceId} />
          <div>
            <Input name="name" required placeholder="Traitement cuir" className="w-44" />
          </div>
          <div>
            <Input name="price_euros" type="number" min={0} step="0.01" required placeholder="Prix €" className="w-24" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>Ajouter</Button>
          {state?.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
