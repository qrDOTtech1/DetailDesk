import Link from "next/link";
import { db } from "@/lib/db";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { consumePortalToken } from "./actions";

/**
 * Magic-link landing. The token is NOT consumed on GET — email scanners
 * (Gmail, Outlook) prefetch links and would burn single-use tokens. The
 * actual login happens on the button's POST.
 */
export default async function PortalLoginPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(token);

  const t = valid
    ? await db.portalLoginToken.findUnique({
        where: { token },
        include: { customer: { include: { business: { select: { name: true, slug: true } } } } },
      })
    : null;
  const usable = t && !t.usedAt && t.expiresAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>
            {usable ? `Espace client — ${t.customer.business.name}` : "Lien invalide ou expiré"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {usable ? (
            <>
              <p className="text-sm text-muted-foreground">
                Bonjour {t.customer.fullName.split(" ")[0]}, clique pour ouvrir ton espace client.
              </p>
              <form action={consumePortalToken.bind(null, token)}>
                <Button type="submit" className="w-full" size="lg">Ouvrir mon espace</Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ce lien de connexion a expiré ou a déjà été utilisé. Demande-en un nouveau — ça prend 10 secondes.
              </p>
              {t?.customer.business.slug ? (
                <Link href={`/b/${t.customer.business.slug}/portail`}>
                  <Button variant="outline" className="w-full">Recevoir un nouveau lien</Button>
                </Link>
              ) : (
                <Link href="/"><Button variant="outline" className="w-full">Retour à l&apos;accueil</Button></Link>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
