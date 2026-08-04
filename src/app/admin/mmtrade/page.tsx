import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "./botUrl";
import { LiveDashboard } from "./LiveDashboard";

// Proxy serveur -> bot MMTRADE (Steven 04/08) : le token ne sort JAMAIS vers
// le navigateur. Ce fetch fournit le premier rendu (rapide, sans ecran vide) ;
// le flux temps reel prend ensuite le relais via /admin/mmtrade/stream (SSE).
async function fetchBot(path: string) {
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return { error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" };
  const base = normalizeBotUrl(rawBase);
  try {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return { error: `bot ${res.status}: ${await res.text()}` };
    return await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "fetch echoue" };
  }
}

export default async function MMTradePage() {
  await requirePlatformAdmin();

  // curves n'est plus fetche ici : CourbesTab (client) recharge lui-meme via
  // /admin/mmtrade/curve, avec zoom -- pas besoin d'un rendu initial pour un
  // onglet qui n'est pas actif par defaut.
  const [snapshot, precheck, killswitch, logs] = await Promise.all([
    fetchBot("/api/snapshot"),
    fetchBot("/api/precheck"),
    fetchBot("/api/killswitch"),
    fetchBot("/api/log?n=5000"), // max supporte par le bot -- "toutes les lignes meme historique"
  ]);

  if (snapshot?.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">MMTrade V1</h1>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
          <div className="text-sm text-red-300">Bot injoignable : {snapshot.error}</div>
          <div className="mt-2 text-xs text-zinc-500">
            Configure MMTRADE_API_URL (domaine public Railway du service MMTV1, ex.
            mmtv1-production.up.railway.app) et MMTRADE_API_TOKEN (meme valeur sur les 2 services) dans les
            variables Railway de DetailDesk.
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveDashboard
      initialSnapshot={snapshot}
      precheck={precheck}
      killswitch={killswitch}
      initialLogs={Array.isArray(logs) ? logs : []}
    />
  );
}
