import Link from "next/link";
import { Button } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-bold text-lg">DetailDesk</span>
          <nav className="flex items-center gap-2">
            <Link href="#tarifs"><Button variant="ghost" className="hidden sm:inline-flex">Tarifs</Button></Link>
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

      <section id="tarifs" className="border-t bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Un tarif simple, sans surprise</h2>
          <p className="mt-2 text-muted-foreground">Tout est inclus. Sans engagement.</p>

          <div className="mx-auto mt-8 max-w-sm rounded-lg border bg-background p-8 text-left shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">DetailDesk Pro</p>
            <p className="mt-2">
              <span className="text-4xl font-bold">29 €</span>
              <span className="text-muted-foreground"> / mois</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Lien de réservation public illimité",
                "Acomptes Stripe sur TON compte (0 % de commission)",
                "Clients, véhicules et historique illimités",
                "Rappels email automatiques",
                "150 SMS de rappel / mois inclus",
                "Relances rebooking + demandes d'avis Google auto",
                "Photos avant/après + galerie publique",
                "Portail client + codes promo",
              ].map((f) => (
                <li key={f} className="flex gap-2"><span className="text-emerald-600">✓</span>{f}</li>
              ))}
            </ul>
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Au-delà des 150 SMS inclus : 1 € par tranche de 10 SMS, décompté en toute
              transparence dans tes réglages. Les paiements de tes clients vont directement
              sur ton compte Stripe.
            </p>
            <Link href="/signup" className="mt-6 block">
              <Button className="w-full" size="lg">Commencer maintenant</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} DetailDesk — un produit Matable.pro</p>
        <p className="mt-1 space-x-3 text-xs">
          <Link href="/legal/mentions-legales" className="hover:underline">Mentions légales</Link>
          <Link href="/legal/cgv" className="hover:underline">CGV</Link>
          <Link href="/legal/confidentialite" className="hover:underline">Confidentialité</Link>
        </p>
      </footer>
    </main>
  );
}
