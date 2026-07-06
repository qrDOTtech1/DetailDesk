import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-bold">DetailDesk</Link>
          <nav className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/legal/mentions-legales" className="hover:underline">Mentions légales</Link>
            <Link href="/legal/cgv" className="hover:underline">CGV</Link>
            <Link href="/legal/confidentialite" className="hover:underline">Confidentialité</Link>
          </nav>
        </div>
      </header>
      <article className="prose-sm mx-auto max-w-3xl space-y-4 px-4 py-10 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm">
        {children}
      </article>
    </main>
  );
}
