import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PortalRequestForm } from "./request-form";

export default async function PortalRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await db.business.findFirst({
    where: { slug, isActive: true }, select: { name: true, slug: true, logoUrl: true },
  });
  if (!business) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 text-center">
          {business.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 rounded-full object-cover" />
          )}
          <h1 className="text-xl font-bold">Espace client — {business.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reçois un lien de connexion par email. Pas de mot de passe.
          </p>
        </div>
        <PortalRequestForm slug={business.slug} />
      </div>
    </main>
  );
}
