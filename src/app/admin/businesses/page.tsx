import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { toggleBusinessTest, toggleBusinessActive } from "../actions";

export default async function AdminBusinessesPage() {
  await requirePlatformAdmin();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [businesses, smsCounts, settingsRows] = await Promise.all([
    db.business.findMany({
      include: { _count: { select: { members: true, bookings: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.smsLog.groupBy({
      by: ["businessId"], _count: { businessId: true },
      where: { createdAt: { gte: monthStart }, status: "sent" },
    }),
    db.businessSettings.findMany({ select: { businessId: true, smsQuotaMonthly: true } }),
  ]);
  const smsFor = (id: string) => smsCounts.find((s) => s.businessId === id)?._count.businessId ?? 0;
  const quotaFor = (id: string) => settingsRows.find((s) => s.businessId === id)?.smsQuotaMonthly ?? 150;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Businesses ({businesses.length})</h1>
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-400">
            <tr>
              <th className="p-3">Nom</th><th className="p-3">Slug</th><th className="p-3">Email</th>
              <th className="p-3">Stripe</th><th className="p-3">Bookings</th><th className="p-3">SMS mois</th><th className="p-3">Flags</th><th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-t border-zinc-800">
                <td className="p-3 font-medium">{b.name}</td>
                <td className="p-3"><Link href={`/b/${b.slug}`} target="_blank" className="text-blue-400 hover:underline">/b/{b.slug}</Link></td>
                <td className="p-3 text-zinc-400">{b.email}</td>
                <td className="p-3">{b.stripeConnected ? "✅" : b.stripeAccountId ? "⏳" : "—"}</td>
                <td className="p-3">{b._count.bookings}</td>
                <td className="p-3 text-xs">
                  {(() => {
                    const sent = smsFor(b.id); const quota = quotaFor(b.id);
                    const over = Math.max(0, sent - quota);
                    return over > 0
                      ? <span className="text-amber-400">{sent}/{quota} (+{Math.ceil(over / 10)}€)</span>
                      : <span>{sent}/{quota}</span>;
                  })()}
                </td>
                <td className="p-3 text-xs">
                  {b.isTest && <span className="mr-1 rounded bg-amber-900 px-1.5 py-0.5">TEST</span>}
                  {!b.isActive && <span className="rounded bg-red-900 px-1.5 py-0.5">INACTIF</span>}
                </td>
                <td className="p-3">
                  <div className="flex gap-2 text-xs">
                    <form action={toggleBusinessTest}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-zinc-400 hover:underline">{b.isTest ? "→ réel" : "→ test"}</button>
                    </form>
                    <form action={toggleBusinessActive}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-zinc-400 hover:underline">{b.isActive ? "désactiver" : "activer"}</button>
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
