"use client";
import { useEffect, useMemo, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "bad" | "warn" }) {
  const toneClass = tone === "ok" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "text-zinc-200";
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 text-[12px] last:border-b-0">
      <span className="text-zinc-500">{label}</span>
      <span className={`tabular-nums font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}

// Diagnostics systeme (Steven 04/08, "dash massif + complet") : precheck
// brut, statut du sidecar Rust (rust_usage_pct deja calcule par le bot,
// jamais affiche en dehors de l'onglet Latence auparavant), etat des
// modules ENGINEBTB3, et un explorateur JSON du snapshot brut pour debugger
// sans avoir a se connecter en SSH -- le dash local donnait acces a l'etat
// brut, celui-ci ne le faisait pas.
export function SystemTab({ snapshot, precheck, connected }: { snapshot: any; precheck: any; connected: boolean }) {
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [latency, setLatency] = useState<any>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch("/admin/mmtrade/enginebtb3", { cache: "no-store" })
      .then((r) => r.json())
      .then(setEngineStatus)
      .catch(() => {});
    fetch("/admin/mmtrade/latency", { cache: "no-store" })
      .then((r) => r.json())
      .then(setLatency)
      .catch(() => {});
  }, []);

  const modes: Record<string, string> = snapshot.modes ?? {};
  const symbols = Object.keys(modes);
  const rustPct = latency?.rust_usage_pct;

  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [pinging, setPinging] = useState(false);

  // Auto-diagnostic reseau navigateur -> proxy DetailDesk (Steven 04/08) :
  // mesure independante de tout ce que le bot renvoie -- utile pour isoler
  // "le bot est lent" de "mon reseau/le proxy Railway->Railway est lent"
  // quand un utilisateur signale une lenteur du dashboard lui-meme.
  async function runPingTest(rounds = 8) {
    setPinging(true);
    const results: number[] = [];
    for (let i = 0; i < rounds; i++) {
      const t0 = performance.now();
      try {
        await fetch("/admin/mmtrade/clock", { cache: "no-store" });
      } catch {
        // ignore -- on garde uniquement les rounds reussis dans l'historique
      }
      results.push(Math.round(performance.now() - t0));
      await new Promise((r) => setTimeout(r, 150));
    }
    setPingHistory((prev) => [...prev, ...results].slice(-40));
    setPinging(false);
  }

  const pingStats = useMemo(() => {
    if (pingHistory.length === 0) return null;
    const sorted = [...pingHistory].sort((a, b) => a - b);
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    return { min: sorted[0], max: sorted[sorted.length - 1], avg: Math.round(avg), n: sorted.length };
  }, [pingHistory]);

  const clientInfo = useMemo(() => {
    if (typeof window === "undefined") return null;
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
      loadedAt: new Date().toLocaleTimeString("fr-FR"),
    };
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-2 text-xs font-medium text-zinc-300">Session navigateur (cote client, diagnostic uniquement)</div>
        {clientInfo ? (
          <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
            <Row label="Fuseau horaire" value={clientInfo.timezone} />
            <Row label="Langue" value={clientInfo.locale} />
            <Row label="Fenetre" value={clientInfo.viewport} />
            <Row label="Reseau navigateur" value={clientInfo.online ? "en ligne" : "hors ligne"} tone={clientInfo.online ? "ok" : "bad"} />
          </div>
        ) : (
          <div className="text-[11px] text-zinc-600">indisponible cote serveur</div>
        )}
        <div className="mt-2 text-[10.5px] text-zinc-600">
          Ces informations decrivent ta session de navigation locale, pas le serveur MMTV1 -- utile pour diagnostiquer
          un affichage different entre deux appareils.
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-300">Auto-diagnostic reseau (navigateur → proxy DetailDesk)</div>
          <button
            onClick={() => runPingTest()}
            disabled={pinging}
            className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20 disabled:opacity-40"
          >
            {pinging ? "Mesure en cours..." : "Lancer 8 mesures"}
          </button>
        </div>
        <p className="mb-2 text-[10.5px] leading-relaxed text-zinc-600">
          Mesure le temps d&apos;aller-retour entre ton navigateur et le proxy Next.js de DetailDesk (pas jusqu&apos;a
          Polymarket) -- separe une lenteur reseau locale/proxy d&apos;une lenteur reelle du bot ou de Polymarket,
          mesurees ailleurs dans l&apos;onglet Latence.
        </p>
        {pingStats ? (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold tabular-nums text-zinc-100">{pingStats.avg}</div>
              <div className="text-[10px] text-zinc-500">moy. ms</div>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums text-emerald-400">{pingStats.min}</div>
              <div className="text-[10px] text-zinc-500">min ms</div>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums text-amber-400">{pingStats.max}</div>
              <div className="text-[10px] text-zinc-500">max ms</div>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums text-zinc-100">{pingStats.n}</div>
              <div className="text-[10px] text-zinc-500">mesures</div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-600">Aucune mesure encore -- clique &quot;Lancer 8 mesures&quot;.</div>
        )}
        {pingHistory.length > 0 && (
          <div className="mt-3 flex h-8 items-end gap-0.5">
            {pingHistory.map((v, i) => {
              const maxV = Math.max(...pingHistory, 1);
              return <div key={i} className="flex-1 rounded-sm bg-sky-500/50" style={{ height: `${Math.max(4, (v / maxV) * 100)}%` }} title={`${v}ms`} />;
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Connexion</div>
          <Row label="Flux temps reel (SSE)" value={connected ? "connecte" : "deconnecte"} tone={connected ? "ok" : "bad"} />
          <Row label="Bot en cours" value={snapshot.running ? "oui" : "non"} tone={snapshot.running ? "ok" : "warn"} />
          <Row label="Symboles suivis" value={symbols.length} />
          <Row label="Positions ouvertes (tous symboles)" value={symbols.reduce((s, sym) => s + Object.keys((snapshot.markets ?? {})[sym]?.open ?? {}).length, 0)} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Precheck capital</div>
          <Row label="Statut" value={precheck?.message ?? "?"} tone={precheck?.ok ? "ok" : "bad"} />
          <Row label="Cash USDC" value={`${Number(precheck?.cash_usdc ?? snapshot.cash_usdc ?? 0).toFixed(4)}$`} />
          <Row label="Plancher configure" value={`${snapshot.floor ?? 0}$`} />
          <Row
            label="Marge au-dessus du plancher"
            value={`${(Number(precheck?.cash_usdc ?? snapshot.cash_usdc ?? 0) - Number(snapshot.floor ?? 0)).toFixed(2)}$`}
            tone={Number(precheck?.cash_usdc ?? snapshot.cash_usdc ?? 0) - Number(snapshot.floor ?? 0) > 0 ? "ok" : "bad"}
          />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Signature Rust (sidecar)</div>
          <Row label="Taux d'utilisation" value={rustPct !== null && rustPct !== undefined ? `${rustPct}%` : "pas encore mesure"} tone={rustPct ? "ok" : "warn"} />
          <Row label="Schema reel de ce compte" value="POLY_1271 (smart wallet)" />
          <Row label="Schemas non couverts" value="1 (proxy), 2 (gnosis-safe)" />
          <Row label="Signature (p50)" value={latency?.stats?.signature_ms?.p50 !== undefined ? `${latency.stats.signature_ms.p50}ms` : "-"} />
          <Row label="Re-signature Rust (p50)" value={latency?.stats?.rust_resign_ms?.p50 !== undefined ? `${latency.stats.rust_resign_ms.p50}ms` : "-"} />
          <Row label="Mesures accumulees" value={latency?.history?.length ?? 0} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">ENGINEBTB3</div>
          <Row label="Statut" value={engineStatus?.status ?? "?"} tone={engineStatus?.status === "paper" ? "warn" : engineStatus?.status === "error" ? "bad" : "ok"} />
          <Row label="Actif (execution reelle)" value={engineStatus?.active ? "oui" : "non"} tone={engineStatus?.active ? "warn" : "ok"} />
          <Row label="Marches configures" value={Array.isArray(engineStatus?.markets) ? engineStatus.markets.length : "-"} />
          <Row label="Marches meteo configures" value={Array.isArray(engineStatus?.weather_markets) ? engineStatus.weather_markets.length : "-"} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Strategies avancees</div>
          <Row label="Market Maker" value={snapshot.mm?.enabled ? "ON" : "off"} tone={snapshot.mm?.enabled ? "ok" : undefined} />
          <Row label="Delta Neutral" value={snapshot.dn?.enabled ? "ON" : "off"} tone={snapshot.dn?.enabled ? "ok" : undefined} />
          <Row label="Ultrapoly / reel" value={`${snapshot.ultrapoly ? "ON" : "off"} / ${snapshot.ultrapoly_real ? "ON" : "off"}`} />
          <Row label="Budget arb par tentative" value={`${snapshot.arb_budget ?? 0}$`} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Kill-switch global</div>
          <Row label="Etat" value={snapshot.killswitch_triggered ? "declenche" : "normal"} tone={snapshot.killswitch_triggered ? "bad" : "ok"} />
          <Row label="Pertes consec. globales" value={snapshot.global_consec_losses ?? "-"} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Repli signature (garde-fou)</div>
          <Row label="Schemas Rust couverts" value="EOA (0) + POLY_1271 (3)" />
          <Row label="Timeout sidecar" value="0.3s" />
          <Row label="Frequence ping keepalive" value="2s" />
          <Row label="En cas d'echec/timeout" value="repli Python automatique" tone="ok" />
        </Card>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-300">Etat brut par symbole</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-white/8 text-zinc-500">
                <th className="px-2 py-2 font-medium">Symbole</th>
                <th className="px-2 py-2 font-medium">Mode</th>
                <th className="px-2 py-2 font-medium">Trades reels</th>
                <th className="px-2 py-2 font-medium">Wins</th>
                <th className="px-2 py-2 font-medium">Positions ouvertes</th>
                <th className="px-2 py-2 font-medium">Pertes consec.</th>
                <th className="px-2 py-2 font-medium">Stoppe</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((sym) => {
                const mk = (snapshot.markets ?? {})[sym] ?? {};
                return (
                  <tr key={sym} className="border-b border-white/5 text-zinc-300 hover:bg-white/[0.02]">
                    <td className="px-2 py-2 font-medium text-zinc-100">{sym}</td>
                    <td className="px-2 py-2 text-zinc-500">{modes[sym]}</td>
                    <td className="px-2 py-2 tabular-nums">{mk.trades_done_real ?? 0}</td>
                    <td className="px-2 py-2 tabular-nums text-emerald-400">{mk.wins_real ?? 0}</td>
                    <td className="px-2 py-2 tabular-nums">{Object.keys(mk.open ?? {}).length}</td>
                    <td className="px-2 py-2 tabular-nums">{mk.consec_losses ?? 0}</td>
                    <td className="px-2 py-2">{mk.stopped ? <span className="text-red-400">{mk.stop_reason ?? "oui"}</span> : <span className="text-zinc-600">non</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <button onClick={() => setShowRaw((v) => !v)} className="text-xs font-medium text-zinc-300 hover:text-zinc-100">
          {showRaw ? "▾" : "▸"} Explorateur JSON (snapshot brut complet)
        </button>
        {showRaw && (
          <pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg bg-black/40 p-3 text-[10.5px] leading-relaxed text-zinc-400">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  );
}
