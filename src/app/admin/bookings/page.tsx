import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookingStatusSchema } from "@/lib/validators";
import { formatCents, formatDateTime } from "@/lib/utils";

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  await requirePlatformAdmin();

  const statusFilter = status ? bookingStatusSchema.safeParse(status) : null;
  const bookings = await db.booking.findMany({
    where: statusFilter?.success ? { status: statusFilter.data } : {},
    include: { business: { select: { name: true, slug: true } }, service: true, customer: true },
    orderBy: { createdAt: "desc" }, take: 200,
  });

  const statuses = ["pending", "confirmed", "completed", "cancelled", "no_show"];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Bookings ({bookings.length})</h1>
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
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-zinc-800">
                <td className="p-3">{b.business.name}</td>
                <td className="p-3 text-zinc-400">{b.customer.fullName}</td>
                <td className="p-3 text-zinc-400">{b.service.name}</td>
                <td className="p-3 text-xs">{formatDateTime(b.startsAt.toISOString())}</td>
                <td className="p-3">{formatCents(b.totalPriceCents)}</td>
                <td className="p-3">{b.depositAmountCents > 0 ? `${formatCents(b.depositAmountCents)} ${b.depositPaid ? "✅" : "⏳"}` : "—"}</td>
                <td className="p-3 text-xs">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
