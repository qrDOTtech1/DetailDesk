import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4 text-center">
      <p className="text-4xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-bold">Page introuvable</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Cette page n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <Link href="/"><Button variant="outline">Retour à l&apos;accueil</Button></Link>
    </main>
  );
}
