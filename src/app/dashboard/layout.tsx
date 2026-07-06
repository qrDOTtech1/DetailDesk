import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui";
import { DashboardNav } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusiness();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard"><Logo size={26} /></Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground">{ctx.business.name}</span>
            {ctx.profile.platform_role === "platform_admin" && (
              <Link href="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
            )}
            <form action={signOut}><Button variant="ghost" size="sm">Déconnexion</Button></form>
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <DashboardNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
