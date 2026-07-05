"use client";
import { useActionState, useState } from "react";
import { createBusiness } from "./actions";
import { slugify } from "@/lib/utils";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(createBusiness, null);
  const [slug, setSlug] = useState("");

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">Crée ton business</CardTitle>
        <CardDescription>C&apos;est la base de ton lien de réservation public.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom du business</Label>
            <Input id="name" name="name" required placeholder="Shine Detailing"
              onChange={(e) => setSlug(slugify(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug public</Label>
            <Input id="slug" name="slug" required value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))} placeholder="shine-detailing" />
            <p className="text-xs text-muted-foreground">Ton lien : /b/{slug || "ton-slug"}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email pro</Label>
              <Input id="email" name="email" type="email" required defaultValue={defaultEmail} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" placeholder="06 12 34 56 78" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" name="address" placeholder="12 rue du Detailing, Paris" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="business_type">Type</Label>
            <Select id="business_type" name="business_type" defaultValue="studio">
              <option value="studio">Studio / centre fixe</option>
              <option value="mobile">Mobile (déplacement)</option>
              <option value="both">Les deux</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logo_url">Logo (URL, optionnel)</Label>
            <Input id="logo_url" name="logo_url" placeholder="https://…" required={false} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cancellation_policy">Politique d&apos;annulation (courte)</Label>
            <Textarea id="cancellation_policy" name="cancellation_policy"
              placeholder="Annulation gratuite jusqu'à 24h avant le rendez-vous." />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Création…" : "Créer mon business"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
