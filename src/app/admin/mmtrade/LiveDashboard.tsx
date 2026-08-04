"use client";
import { useEffect, useState } from "react";
import { Tabs } from "./Tabs";
import { CourbesTab } from "./CourbesTab";
import { PositionsTab } from "./PositionsTab";
import { HistoriqueTab } from "./HistoriqueTab";
import { LatenceTab } from "./LatenceTab";
import { EngineBTB3Tab } from "./EngineBTB3Tab";
import { PrevisionsTab } from "./PrevisionsTab";
import { RealHistoryTab } from "./RealHistoryTab";
import { StrategiesTab } from "./StrategiesTab";
import { SystemTab } from "./SystemTab";
import { WatchTab } from "./WatchTab";
import { DocumentationTab } from "./DocumentationTab";
import { JournalTab } from "./JournalTab";
import { startBot, stopBot, setSymbolMode, resetKillswitch, updateKillswitchConfig, setFloor, toggleOpportunity, toggleRiskFree } from "./actions";

const MODES = ["off", "paper", "real"] as const;
const MODE_STYLE: Record<string, string> = {
  real: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  paper: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  off: "bg-white/5 text-zinc-500 ring-1 ring-white/10",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function Money({ v }: { v: number | undefined }) {
  const n = v ?? 0;
  return <span className={n >= 0 ? "text-emerald-400" : "text-red-400"}>{n >= 0 ? "+" : ""}{n.toFixed(3)}$</span>;
}

function ConnDot({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
      {connected ? "temps reel" : "deconnecte"}
    </span>
  );
}

export function LiveDashboard({
  initialSnapshot,
  precheck,
  killswitch,
  initialLogs,
}: {
  initialSnapshot: any;
  precheck: any;
  killswitch: any;
  initialLogs: string[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [logs, setLogs] = useState(initialLogs);
  const [connected, setConnected] = useState(false);

  // EventSource natif ne peut pas envoyer de header Authorization -> on se
  // connecte au proxy same-origin /admin/mmtrade/stream (route.ts), qui lui
  // porte le token cote serveur. Vrai push, pas de polling (Steven 04/08).
  useEffect(() => {
    const es = new EventSource("/admin/mmtrade/stream");
    es.addEventListener("snapshot", (e) => {
      try { setSnapshot(JSON.parse((e as MessageEvent).data)); } catch {}
    });
    es.addEventListener("log", (e) => {
      // FUSION PAR CHEVAUCHEMENT (Steven 04/08) : le bot pousse seulement les
      // 30 dernieres lignes toutes les 2s. Un setLogs(nouvelles_lignes) direct
      // REMPLACAIT tout l'historique deja affiche a chaque push -> impossible
      // de scroller en arriere ou de selectionner du texte (le DOM entier
      // etait detruit et recree toutes les 2s). On cherche le plus long
      // chevauchement entre la fin de ce qu'on a deja et le debut du nouveau
      // paquet, et on n'AJOUTE que les lignes reellement nouvelles.
      try {
        const incoming: string[] = JSON.parse((e as MessageEvent).data);
        setLogs((prev) => {
          let overlap = 0;
          const maxCheck = Math.min(prev.length, incoming.length);
          for (let k = maxCheck; k > 0; k--) {
            if (prev.slice(prev.length - k).join("\n") === incoming.slice(0, k).join("\n")) {
              overlap = k;
              break;
            }
          }
          const fresh = incoming.slice(overlap);
          if (fresh.length === 0) return prev;
          const merged = [...prev, ...fresh];
          // borne genereuse (5000, meme plafond que le bot) -- pas de perte
          // silencieuse en usage normal, juste un garde-fou memoire.
          return merged.length > 5000 ? merged.slice(merged.length - 5000) : merged;
        });
      } catch {}
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const modes: Record<string, string> = snapshot.modes ?? {};
  const markets: Record<string, any> = snapshot.markets ?? {};
  const symbols = Object.keys(modes);
  const ks = killswitch?.config ?? {};
  const triggered = killswitch?.triggered;
  const floor = snapshot.floor ?? 0;

  const totalReal = symbols.reduce((s, sym) => s + (markets[sym]?.pnl_total_real ?? 0), 0);
  const openPositions = symbols.flatMap((sym) => (markets[sym]?.open ?? []).map((p: any) => ({ ...p, __sym: sym })));
  // price_log par symbole/slug (Up/Down des marches recents) : deja pousse
  // en direct dans snapshot.markets[sym].price_log, aucun fetch separe.
  const priceLogBySymbol: Record<string, Record<string, any[]>> = {};
  for (const sym of symbols) {
    if (markets[sym]?.price_log) priceLogBySymbol[sym] = markets[sym].price_log;
  }

  const overview = (
    <div className="space-y-5">
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
          <div className={`mt-1 text-sm font-medium ${precheck?.ok ? "text-emerald-400" : "text-red-400"}`}>{precheck?.message ?? "?"}</div>
        </Card>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300">
        Le PnL interne peut diverger de la realite on-chain (deja observe : ecart de plusieurs dizaines de
        dollars sur une session). Se referer a l&apos;historique Polymarket reel pour toute decision de capital.
      </div>

      <Card>
        <div className="text-sm font-medium">Plancher de capital</div>
        <div className="mt-1 text-[11px] text-zinc-500">
          Le bot refuse d&apos;engager du capital sous ce plancher. Mets 0 pour desactiver la protection.
        </div>
        <form action={setFloor} className="mt-3 flex items-center gap-2">
          <input name="floor" type="number" step="0.5" min="0" defaultValue={floor} className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-100" />
          <span className="text-xs text-zinc-500">$ actuellement : {floor}$</span>
          <button className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">Enregistrer</button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Kill-switch global</div>
          {triggered ? (
            <form action={resetKillswitch}>
              <button className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">Reset (ne relance pas le trading)</button>
            </form>
          ) : null}
        </div>
        {triggered && (
          <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <div>Declenche : {triggered.reason}</div>
            {triggered.ts && (
              <div className="mt-0.5 text-[10.5px] text-red-400/70">
                {new Date((triggered.ts > 1e12 ? triggered.ts : triggered.ts * 1000)).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            )}
          </div>
        )}
        <form action={updateKillswitchConfig} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Plancher cash ($)
            <input name="cash_floor_usd" type="number" step="0.1" defaultValue={ks.cash_floor_usd} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-100" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Perte session max ($)
            <input name="max_session_loss_usd" type="number" step="0.5" defaultValue={ks.max_session_loss_usd} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-100" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Pertes consec. max
            <input name="max_global_consec_losses" type="number" defaultValue={ks.max_global_consec_losses} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-100" />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <input type="checkbox" name="enabled" defaultChecked={ks.enabled} className="accent-emerald-500" />
              actif
            </label>
            <button className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">Enregistrer</button>
          </div>
        </form>
      </Card>

      {/* Strategies avancees, budget arb, zone danger : deplaces dans leur
          propre onglet "Strategies" (Steven 04/08) plutot que noyes dans la
          vue d'ensemble -- voir StrategiesTab.tsx. */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((sym) => {
          const mk = markets[sym] ?? {};
          return (
            <Card key={sym}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{sym}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MODE_STYLE[modes[sym]] ?? MODE_STYLE.off}`}>{modes[sym]}</span>
                  {mk.risk_free && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/30">risk-free</span>}
                </div>
                <span className="text-sm font-semibold tabular-nums"><Money v={mk.pnl_total_real} /></span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-400">
                <div><div className="text-zinc-200 tabular-nums">{mk.trades_done_real ?? 0}</div>trades</div>
                <div><div className="text-emerald-400 tabular-nums">{mk.wins_real ?? 0}</div>wins</div>
                <div><div className="text-red-400 tabular-nums">{(mk.trades_done_real ?? 0) - (mk.wins_real ?? 0)}</div>losses</div>
              </div>
              {mk.consec_losses > 0 && <div className="mt-2 text-[11px] text-amber-400">{mk.consec_losses} perte(s) consecutive(s)</div>}
              {mk.stopped && <div className="mt-1 text-[11px] text-red-400">stoppe : {mk.stop_reason}</div>}
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
              <div className="mt-2 flex items-center gap-1.5">
                <form action={toggleOpportunity}>
                  <input type="hidden" name="symbol" value={sym} />
                  <input type="hidden" name="enabled" value={String(!!mk.opportunity)} />
                  <button
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      mk.opportunity ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30" : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/8"
                    }`}
                  >
                    opportunité {mk.opportunity ? "ON" : "off"}
                  </button>
                </form>
                <form action={toggleRiskFree}>
                  <input type="hidden" name="symbol" value={sym} />
                  <input type="hidden" name="enabled" value={String(!!mk.risk_free)} />
                  <button
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      mk.risk_free ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/8"
                    }`}
                  >
                    risk-free {mk.risk_free ? "ON" : "off"}
                  </button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const journal = <JournalTab logs={logs} connected={connected} />;

  return (
    <div className="space-y-5" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">MMTrade V1</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${snapshot.running ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-zinc-500 ring-1 ring-white/10"}`}>
            {snapshot.running ? "en cours" : "arrete"}
          </span>
          {triggered && <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30">kill-switch declenche</span>}
        </div>
        <div className="flex items-center gap-2">
          <ConnDot connected={connected} />
          <form action={startBot}>
            <button className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">Demarrer</button>
          </form>
          <form action={stopBot}>
            <button className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-500/25">Arreter</button>
          </form>
        </div>
      </div>

      <Tabs
        tabs={[
          { label: "Vue d'ensemble", content: overview, badge: triggered ? "!" : undefined },
          { label: "Horloge", content: <WatchTab cashUsdc={Number(snapshot.cash_usdc ?? 0)} totalPnl={totalReal} /> },
          { label: "Previsions", content: <PrevisionsTab /> },
          { label: "Courbes", content: <CourbesTab priceLogBySymbol={priceLogBySymbol} /> },
          { label: "Positions", content: <PositionsTab positions={openPositions} />, badge: openPositions.length || undefined },
          { label: "Historique", content: <HistoriqueTab symbols={symbols} /> },
          { label: "Historique reel (on-chain)", content: <RealHistoryTab /> },
          { label: "Latence", content: <LatenceTab /> },
          { label: "Strategies", content: <StrategiesTab snapshot={snapshot} /> },
          { label: "ENGINEBTB3", content: <EngineBTB3Tab /> },
          { label: "Systeme", content: <SystemTab snapshot={snapshot} precheck={precheck} connected={connected} /> },
          { label: "Journal", content: journal },
          { label: "Aide", content: <DocumentationTab /> },
        ]}
      />
    </div>
  );
}
