import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export default async function AdminUsersPage() {
  await requirePlatformAdmin();
  const users = await db.profile.findMany({
    include: { memberships: { include: { business: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Users ({users.length})</h1>
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs text-zinc-400">
            <tr><th className="p-3">Email</th><th className="p-3">Nom</th><th className="p-3">Rôle</th><th className="p-3">Business</th><th className="p-3">Créé</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-800">
                <td className="p-3">{u.email}</td>
                <td className="p-3 text-zinc-400">{u.fullName || "—"}</td>
                <td className="p-3">{u.platformRole === "platform_admin"
                  ? <span className="rounded bg-purple-900 px-1.5 py-0.5 text-xs">ADMIN</span> : "user"}</td>
                <td className="p-3 text-zinc-400">
                  {u.memberships.map((m) => `${m.business.name} (${m.role})`).join(", ") || "—"}
                </td>
                <td className="p-3 text-zinc-500 text-xs">{formatDateTime(u.createdAt.toISOString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
