import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui";

const nav = [
  ["/dashboard", "Aperçu"],
  ["/dashboard/bookings", "Réservations"],
  ["/dashboard/services", "Services"],
  ["/dashboard/customers", "Clients"],
  ["/dashboard/availability", "Disponibilités"],
  ["/dashboard/settings", "Réglages"],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusiness();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            <Link href="/dashboard" className="font-bold shrink-0">DetailDesk</Link>
            <nav className="flex items-center gap-1">
              {nav.map(([href, label]) => (
                <Link key={href} href={href}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground whitespace-nowrap">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:block text-sm text-muted-foreground">{ctx.business.name}</span>
            {ctx.profile.platform_role === "platform_admin" && (
              <Link href="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
            )}
            <form action={signOut}><Button variant="ghost" size="sm">Déconnexion</Button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
