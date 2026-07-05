import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/utils";

export default async function AdminPage() {
  await requirePlatformAdmin();

  const [businesses, userCount, bookings, payments, emailFails] = await Promise.all([
    db.business.findMany({ select: { id: true, isTest: true, stripeConnected: true } }),
    db.profile.count(),
    db.booking.findMany({ select: { id: true, status: true } }),
    db.payment.findMany({ select: { amountCents: true, status: true } }),
    db.emailLog.count({ where: { status: { startsWith: "failed" } } }),
  ]);

  const totalDeposits = payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amountCents, 0);
  const pendingPayments = payments.filter((p) => p.status === "pending").length;
  const failedPayments = payments.filter((p) => p.status === "failed").length;
  const stripeConnected = businesses.filter((b) => b.stripeConnected).length;
  const testBusinesses = businesses.filter((b) => b.isTest).length;
  const byStatus = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const stats: [string, string | number][] = [
    ["Businesses", businesses.length],
    ["dont test/internal", testBusinesses],
    ["Stripe connectés", stripeConnected],
    ["Users", userCount],
    ["Bookings", bookings.length],
    ["Acomptes encaissés", formatCents(totalDeposits)],
    ["Paiements pending", pendingPayments],
    ["Paiements failed", failedPayments],
    ["Emails en échec", emailFails],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Plateforme — stats globales</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <p className="mb-2 text-xs text-zinc-400">Bookings par statut</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.entries(byStatus).map(([s, n]) => (
            <span key={s} className="rounded bg-zinc-800 px-2 py-1">{s}: <strong>{n}</strong></span>
          ))}
          {Object.keys(byStatus).length === 0 && <span className="text-zinc-500">Aucune réservation.</span>}
        </div>
      </div>
    </div>
  );
}
