import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toggleBusinessTest, toggleBusinessActive } from "../actions";

export default async function AdminBusinessesPage() {
  await requirePlatformAdmin();
  const supabase = createAdminClient();
  const { data: businesses } = await supabase.from("businesses")
    .select("*, business_members(count), bookings(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Businesses ({businesses?.length ?? 0})</h1>
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-400">
            <tr>
              <th className="p-3">Nom</th><th className="p-3">Slug</th><th className="p-3">Email</th>
              <th className="p-3">Stripe</th><th className="p-3">Bookings</th><th className="p-3">Flags</th><th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(businesses ?? []).map((b) => (
              <tr key={b.id} className="border-t border-zinc-800">
                <td className="p-3 font-medium">{b.name}</td>
                <td className="p-3"><Link href={`/b/${b.slug}`} target="_blank" className="text-blue-400 hover:underline">/b/{b.slug}</Link></td>
                <td className="p-3 text-zinc-400">{b.email}</td>
                <td className="p-3">{b.stripe_connected ? "✅" : b.stripe_account_id ? "⏳" : "—"}</td>
                <td className="p-3">{(b.bookings as { count: number }[])?.[0]?.count ?? 0}</td>
                <td className="p-3 text-xs">
                  {b.is_test && <span className="mr-1 rounded bg-amber-900 px-1.5 py-0.5">TEST</span>}
                  {!b.is_active && <span className="rounded bg-red-900 px-1.5 py-0.5">INACTIF</span>}
                </td>
                <td className="p-3">
                  <div className="flex gap-2 text-xs">
                    <form action={toggleBusinessTest}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-zinc-400 hover:underline">{b.is_test ? "→ réel" : "→ test"}</button>
                    </form>
                    <form action={toggleBusinessActive}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-zinc-400 hover:underline">{b.is_active ? "désactiver" : "activer"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
