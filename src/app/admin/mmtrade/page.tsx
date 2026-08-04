import { requirePlatformAdmin } from "@/lib/auth";
import { AutoRefresh } from "./AutoRefresh";
import { startBot, stopBot, setSymbolMode, resetKillswitch, updateKillswitchConfig } from "./actions";

// Proxy serveur -> bot MMTRADE (Steven 04/08) : le token ne sort JAMAIS vers
// le navigateur. Service Railway DEDIE (repo MMTV1, separe de DetailDesk),
// joignable via le RESEAU PRIVE Railway, jamais expose publiquement.
async function fetchBot(path: string) {
  const base = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!base || !token) {
    return { error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures (URL reseau prive Railway du service MMTV1)" };
  }
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

const MODES = ["off", "paper", "real"] as const;
const MODE_STYLE: Record<string, string> = {
  real: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  paper: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  off: "bg-white/5 text-zinc-500 ring-1 ring-white/10",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Money({ v }: { v: number | undefined }) {
  const n = v ?? 0;
  return <span className={n >= 0 ? "text-emerald-400" : "text-red-400"}>{n >= 0 ? "+" : ""}{n.toFixed(3)}$</span>;
}

export default async function MMTradePage() {
  await requirePlatformAdmin();

  const [snapshot, precheck, killswitch, logs] = await Promise.all([
    fetchBot("/api/snapshot"),
    fetchBot("/api/precheck"),
    fetchBot("/api/killswitch"),
    fetchBot("/api/log?n=50"),
  ]);

  if (snapshot?.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">MMTrade V1</h1>
        <Card className="border-red-500/20 bg-red-500/[0.06]">
          <div className="text-sm text-red-300">Bot injoignable : {snapshot.error}</div>
          <div className="mt-2 text-xs text-zinc-500">
            Configure MMTRADE_API_URL (hostname reseau prive Railway du service MMTV1, ex.
            http://mmtv1.railway.internal:8787) et MMTRADE_API_TOKEN (= GHOST_API_TOKEN du bot) dans les
            variables Railway de DetailDesk.
          </div>
        </Card>
      </div>
    );
  }

  const modes: Record<string, string> = snapshot.modes ?? {};
  const markets: Record<string, any> = snapshot.markets ?? {};
  const symbols = Object.keys(modes);
  const ks = killswitch?.config ?? {};
  const triggered = killswitch?.triggered;

  // Trades recents, tous symboles confondus, tries par date desc
  const allTrades = symbols
    .flatMap((sym) => (markets[sym]?.trades ?? []).map((t: any) => ({ ...t, __sym: sym })))
    .filter((t: any) => t.mode === "real")
    .sort((a: any, b: any) => (b.opened_ts ?? b.ts ?? 0) - (a.opened_ts ?? a.ts ?? 0))
    .slice(0, 15);

  const totalReal = symbols.reduce((s, sym) => s + (markets[sym]?.pnl_total_real ?? 0), 0);
  const openPositions = symbols.flatMap((sym) => (markets[sym]?.open ?? []).map((p: any) => ({ ...p, __sym: sym })));

  return (
    <div className="space-y-5" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">MMTrade V1</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              snapshot.running ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-zinc-500 ring-1 ring-white/10"
            }`}
          >
            {snapshot.running ? "en cours" : "arrete"}
          </span>
          {triggered && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30">
              kill-switch declenche
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AutoRefresh seconds={8} />
          <form action={startBot}>
            <button className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">
              Demarrer
            </button>
          </form>
          <form action={stopBot}>
            <button className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-500/25">
              Arreter
            </button>
          </form>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-[11px] text-zinc-500">Cash</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{Number(snapshot.cash_usdc ?? 0).toFixed(2)}$</div>
        </Card>
        <Card>
          <div className="text-[11px] text-zinc-500">PnL reel total (interne)</div>
          <div className="mt-1 text-xl font-semibold tabular-nums"><Money v={totalReal} /></div>
        </Card>
        <Card>
          <div className="text-[11px] text-zinc-500">Positions ouvertes</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{openPositions.length}</div>
        </Card>
        <Card>
          <div className="text-[11px] text-zinc-500">Precheck</div>
          <div className={`mt-1 text-sm font-medium ${precheck?.ok ? "text-emerald-400" : "text-red-400"}`}>
            {precheck?.message ?? "?"}
          </div>
        </Card>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300">
        Le PnL interne peut diverger de la realite on-chain (deja observe : ecart de plusieurs dizaines de
        dollars sur une session). Se referer a l&apos;historique Polymarket reel pour toute decision de capital.
      </div>

      {/* Kill-switch */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Kill-switch global</div>
          {triggered ? (
            <form action={resetKillswitch}>
              <button className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">
                Reset (ne relance pas le trading)
              </button>
            </form>
          ) : null}
        </div>
        {triggered && (
          <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Declenche : {triggered.reason}
          </div>
        )}
        <form action={updateKillswitchConfig} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Plancher cash ($)
            <input
              name="cash_floor_usd"
              type="number"
              step="0.1"
              defaultValue={ks.cash_floor_usd}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Perte session max ($)
            <input
              name="max_session_loss_usd"
              type="number"
              step="0.5"
              defaultValue={ks.max_session_loss_usd}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Pertes consec. max
            <input
              name="max_global_consec_losses"
              type="number"
              defaultValue={ks.max_global_consec_losses}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-100"
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <input type="checkbox" name="enabled" defaultChecked={ks.enabled} className="accent-emerald-500" />
              actif
            </label>
            <button className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">
              Enregistrer
            </button>
          </div>
        </form>
      </Card>

      {/* Symbols */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((sym) => {
          const mk = markets[sym] ?? {};
          return (
            <Card key={sym}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{sym}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MODE_STYLE[modes[sym]] ?? MODE_STYLE.off}`}>
                    {modes[sym]}
                  </span>
                  {mk.risk_free && (
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/30">
                      risk-free
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums"><Money v={mk.pnl_total_real} /></span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-400">
                <div>
                  <div className="text-zinc-200 tabular-nums">{mk.trades_done_real ?? 0}</div>
                  trades
                </div>
                <div>
                  <div className="text-emerald-400 tabular-nums">{mk.wins_real ?? 0}</div>
                  wins
                </div>
                <div>
                  <div className="text-red-400 tabular-nums">{(mk.trades_done_real ?? 0) - (mk.wins_real ?? 0)}</div>
                  losses
                </div>
              </div>
              {mk.consec_losses > 0 && (
                <div className="mt-2 text-[11px] text-amber-400">{mk.consec_losses} perte(s) consecutive(s)</div>
              )}
              {mk.stopped && (
                <div className="mt-1 text-[11px] text-red-400">stoppe : {mk.stop_reason}</div>
              )}
              <form action={setSymbolMode} className="mt-3 flex items-center gap-1.5">
                <input type="hidden" name="symbol" value={sym} />
                {MODES.map((m) => (
                  <button
                    key={m}
                    name="mode"
                    value={m}
                    className={`flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
                      modes[sym] === m ? MODE_STYLE[m] : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/8"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </form>
            </Card>
          );
        })}
      </div>

      {/* Open positions */}
      {openPositions.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-medium">Positions ouvertes ({openPositions.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="pb-1 pr-3">Symbole</th>
                  <th className="pb-1 pr-3">Cote</th>
                  <th className="pb-1 pr-3">Entree</th>
                  <th className="pb-1 pr-3">Parts</th>
                  <th className="pb-1">Strategie</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {openPositions.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1 pr-3 font-medium">{p.__sym}</td>
                    <td className="py-1 pr-3">{p.side}</td>
                    <td className="py-1 pr-3 tabular-nums">{Number(p.entry_price ?? 0).toFixed(3)}</td>
                    <td className="py-1 pr-3 tabular-nums">{Number(p.filled_shares ?? 0).toFixed(2)}</td>
                    <td className="py-1 text-zinc-500">{p.strat ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent trades */}
      <Card>
        <div className="mb-2 text-sm font-medium">Trades reels recents</div>
        {allTrades.length === 0 ? (
          <div className="text-xs text-zinc-500">Aucun trade reel encore.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="pb-1 pr-3">Symbole</th>
                  <th className="pb-1 pr-3">Cote</th>
                  <th className="pb-1 pr-3">PnL</th>
                  <th className="pb-1">Resultat</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {allTrades.map((t: any, i: number) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1 pr-3 font-medium">{t.__sym}</td>
                    <td className="py-1 pr-3">{t.side ?? "-"}</td>
                    <td className="py-1 pr-3 tabular-nums"><Money v={t.pnl} /></td>
                    <td className="py-1">
                      <span className={t.win ? "text-emerald-400" : "text-red-400"}>{t.win ? "gain" : "perte"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Log tail */}
      <Card>
        <div className="mb-2 text-sm font-medium">Journal recent</div>
        {Array.isArray(logs) ? (
          <div className="max-h-72 overflow-y-auto rounded-lg bg-black/30 p-2 font-mono text-[10.5px] leading-relaxed text-zinc-400">
            {logs.slice(-50).map((l: string, i: number) => (
              <div key={i} className="whitespace-pre-wrap break-all">{l}</div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-500">Journal indisponible : {logs?.error}</div>
        )}
      </Card>
    </div>
  );
}
