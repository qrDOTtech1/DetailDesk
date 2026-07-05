import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/utils";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const [businesses, users, bookings, payments, emailFails] = await Promise.all([
    supabase.from("businesses").select("id, is_test, stripe_connected", { count: "exact" }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id, status", { count: "exact" }),
    supabase.from("payments").select("amount_cents, status"),
    supabase.from("email_logs").select("id", { count: "exact", head: true }).like("status", "failed%"),
  ]);

  const totalDeposits = (payments.data ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount_cents, 0);
  const pendingPayments = (payments.data ?? []).filter((p) => p.status === "pending").length;
  const failedPayments = (payments.data ?? []).filter((p) => p.status === "failed").length;
  const stripeConnected = (businesses.data ?? []).filter((b) => b.stripe_connected).length;
  const testBusinesses = (businesses.data ?? []).filter((b) => b.is_test).length;
  const byStatus = (bookings.data ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const stats: [string, string | number][] = [
    ["Businesses", businesses.count ?? 0],
    ["dont test/internal", testBusinesses],
    ["Stripe connectés", stripeConnected],
    ["Users", users.count ?? 0],
    ["Bookings", bookings.count ?? 0],
    ["Acomptes encaissés", formatCents(totalDeposits)],
    ["Paiements pending", pendingPayments],
    ["Paiements failed", failedPayments],
    ["Emails en échec", emailFails.count ?? 0],
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
