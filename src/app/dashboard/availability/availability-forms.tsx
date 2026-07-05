"use client";
import { useActionState } from "react";
import { addAvailabilityRule, addBlockedSlot, deleteAvailabilityRule, deleteBlockedSlot } from "../actions";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui";

export function AvailabilityForms() {
  const [ruleState, ruleAction, rulePending] = useActionState(addAvailabilityRule, null);
  const [slotState, slotAction, slotPending] = useActionState(addBlockedSlot, null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Ajouter un horaire</CardTitle></CardHeader>
        <CardContent>
          <form action={ruleAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Jour</Label>
              <Select name="weekday" defaultValue="1">
                <option value="1">Lundi</option><option value="2">Mardi</option>
                <option value="3">Mercredi</option><option value="4">Jeudi</option>
                <option value="5">Vendredi</option><option value="6">Samedi</option>
                <option value="0">Dimanche</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Début</Label><Input name="start_time" type="time" defaultValue="09:00" required /></div>
              <div className="space-y-1.5"><Label>Fin</Label><Input name="end_time" type="time" defaultValue="18:00" required /></div>
            </div>
            {ruleState?.error && <p className="text-sm text-destructive">{ruleState.error}</p>}
            {ruleState?.success && <p className="text-sm text-emerald-600">{ruleState.success}</p>}
            <Button type="submit" disabled={rulePending} className="w-full">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bloquer une période</CardTitle></CardHeader>
        <CardContent>
          <form action={slotAction} className="space-y-3">
            <div className="space-y-1.5"><Label>Du</Label><Input name="starts_at" type="datetime-local" required /></div>
            <div className="space-y-1.5"><Label>Au</Label><Input name="ends_at" type="datetime-local" required /></div>
            <div className="space-y-1.5"><Label>Raison (optionnel)</Label><Input name="reason" placeholder="Congés" /></div>
            {slotState?.error && <p className="text-sm text-destructive">{slotState.error}</p>}
            {slotState?.success && <p className="text-sm text-emerald-600">{slotState.success}</p>}
            <Button type="submit" disabled={slotPending} className="w-full">Bloquer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function RuleDeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteAvailabilityRule}>
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" type="submit">Supprimer</Button>
    </form>
  );
}

export function SlotDeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteBlockedSlot}>
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" type="submit">Supprimer</Button>
    </form>
  );
}
