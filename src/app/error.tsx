"use client";
import { Button } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4 text-center">
      <p className="text-4xl">😕</p>
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ce n&apos;est pas de ton côté. Réessaie — si le problème persiste, contacte le support.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
