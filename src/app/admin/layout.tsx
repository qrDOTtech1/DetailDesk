import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui";

const nav = [
  ["/admin", "Stats"],
  ["/admin/businesses", "Businesses"],
  ["/admin/users", "Users"],
  ["/admin/bookings", "Bookings"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm">DetailDesk ADMIN</span>
            <nav className="flex gap-1">
              {nav.map(([href, label]) => (
                <Link key={href} href={href}
                  className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xs text-zinc-400 hover:underline">← App</Link>
            <form action={signOut}><Button variant="ghost" size="sm" className="text-zinc-400">Exit</Button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
