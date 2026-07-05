import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents, formatDateTime } from "@/lib/utils";

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  let query = supabase.from("bookings")
    .select("*, businesses(name, slug), services(name), customers(full_name)")
    .order("created_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  const { data: bookings } = await query;

  const statuses = ["pending", "confirmed", "completed", "cancelled", "no_show"];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Bookings ({bookings?.length ?? 0})</h1>
      <div className="flex gap-2 text-xs">
        <Link href="/admin/bookings" className={!status ? "font-bold" : "text-zinc-400"}>toutes</Link>
        {statuses.map((s) => (
          <Link key={s} href={`/admin/bookings?status=${s}`}
            className={status === s ? "font-bold" : "text-zinc-400 hover:underline"}>{s}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-400">
            <tr><th className="p-3">Business</th><th className="p-3">Client</th><th className="p-3">Service</th>
              <th className="p-3">Date</th><th className="p-3">Prix</th><th className="p-3">Acompte</th><th className="p-3">Statut</th></tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b) => (
              <tr key={b.id} className="border-t border-zinc-800">
                <td className="p-3">{(b.businesses as { name?: string } | null)?.name}</td>
                <td className="p-3 text-zinc-400">{(b.customers as { full_name?: string } | null)?.full_name}</td>
                <td className="p-3 text-zinc-400">{(b.services as { name?: string } | null)?.name}</td>
                <td className="p-3 text-xs">{formatDateTime(b.starts_at)}</td>
                <td className="p-3">{formatCents(b.total_price_cents)}</td>
                <td className="p-3">{b.deposit_amount_cents > 0 ? `${formatCents(b.deposit_amount_cents)} ${b.deposit_paid ? "✅" : "⏳"}` : "—"}</td>
                <td className="p-3 text-xs">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
