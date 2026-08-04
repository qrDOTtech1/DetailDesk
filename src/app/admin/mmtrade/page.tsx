import { requirePlatformAdmin } from "@/lib/auth";

// Proxy serveur -> bot GHOST (Steven 04/08) : le token et l'URL du bot ne
// sortent JAMAIS vers le navigateur. Cette page tourne en Server Component,
// fait le fetch cote serveur, et ne renvoie au client que du HTML deja rempli.
async function fetchBot(path: string) {
  const base = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!base || !token) return { error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" };
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { error: `bot ${res.status}: ${await res.text()}` };
    return await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "fetch echoue" };
  }
}

export default async function MMTradePage() {
  await requirePlatformAdmin();

  const [snapshot, precheck] = await Promise.all([
    fetchBot("/api/snapshot"),
    fetchBot("/api/precheck"),
  ]);

  if (snapshot?.error || precheck?.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">MMTrade (GHOST)</h1>
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          Bot injoignable : {snapshot?.error || precheck?.error}
          <div className="mt-2 text-xs text-zinc-500">
            Configure MMTRADE_API_URL et MMTRADE_API_TOKEN dans les variables Railway de
            DetailDesk (meme token que GHOST_API_TOKEN sur le service ghost-bot).
          </div>
        </div>
      </div>
    );
  }

  const modes: Record<string, string> = snapshot.modes ?? {};
  const markets: Record<string, { pnl_total_real?: number }> = snapshot.markets ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">MMTrade (GHOST)</h1>
        <span
          className={`rounded px-2 py-1 text-xs ${
            snapshot.running ? "bg-green-900 text-green-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {snapshot.running ? "actif" : "arrete"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-xs text-zinc-500">Cash</div>
          <div className="text-lg font-bold">{Number(snapshot.cash_usdc ?? 0).toFixed(2)}$</div>
        </div>
        {Object.entries(markets).map(([sym, mk]) => (
          <div key={sym} className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">
              {sym} <span className="ml-1 opacity-60">({modes[sym] ?? "?"})</span>
            </div>
            <div
              className={`text-lg font-bold ${
                (mk.pnl_total_real ?? 0) >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {Number(mk.pnl_total_real ?? 0).toFixed(3)}$
            </div>
          </div>
        ))}
      </div>

      <div className="rounded border border-yellow-900 bg-yellow-950/30 p-3 text-xs text-yellow-300">
        Le PnL interne ci-dessus peut diverger de la realite on-chain (deja
        observe : ecart de plusieurs dizaines de dollars pendant une session).
        Verifier toujours via l'historique Polymarket reel avant toute decision.
      </div>

      <div className="text-xs text-zinc-500">
        Precheck: {precheck.message} ({precheck.ok ? "ok" : "KO"})
      </div>
    </div>
  );
}
