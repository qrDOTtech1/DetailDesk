import Link from "next/link";
import { Button } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-bold text-lg">DetailDesk</span>
          <nav className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost">Connexion</Button></Link>
            <Link href="/signup"><Button>Créer mon compte</Button></Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ton lien de réservation pro pour le detailing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Acomptes, rappels automatiques et historique client. Fini les leads perdus en DM,
            les no-shows et les infos éparpillées.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup"><Button size="lg">Démarrer gratuitement</Button></Link>
            <Link href="/login"><Button size="lg" variant="outline">Se connecter</Button></Link>
          </div>
          <div className="mt-14 grid gap-6 text-left sm:grid-cols-3">
            {[
              ["Lien de réservation", "Une page publique propre avec tes services, tes prix et tes créneaux."],
              ["Acomptes Stripe", "Tes clients paient un acompte directement sur TON compte Stripe."],
              ["Rappels automatiques", "Emails de confirmation et rappel 24h avant. Moins de no-shows."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border p-5">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} DetailDesk
      </footer>
    </main>
  );
}
