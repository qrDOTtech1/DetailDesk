"use client";
import { useEffect, useMemo, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}

function fmtTs(ts: number | string | undefined) {
  if (!ts) return "-";
  const n = typeof ts === "string" ? Number(ts) : ts;
  const ms = n > 1e12 ? n : n * 1000;
  try {
    return new Date(ms).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return String(ts);
  }
}

type SortKey = "ts" | "market" | "side" | "size" | "price" | "cost";

// Historique REEL on-chain (Steven 04/08, "le dash doit etre + complet que
// le dash local"). Source : data-api.polymarket.com/activity (lecture seule,
// publique), deja recupere cote bot via fetch_real_history() mais jamais
// affiche dans le dash web avant cette iteration -- seul le PnL INTERNE
// (potentiellement divergent, cf. bandeau d'avertissement de la vue
// d'ensemble) etait visible. C'est la reference que Steven a demande de
// consulter "pour toute decision de capital".
export function RealHistoryTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<string>("tous");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ts");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function load() {
    setLoading(true);
    fetch("/admin/mmtrade/real-history", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else if (d?.ok === false) setError(d.error ?? "erreur inconnue cote bot");
        else {
          setError(null);
          setData(d);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const trades: any[] = data?.trades ?? [];

  const sides = useMemo(() => Array.from(new Set(trades.map((t) => t.side).filter(Boolean))), [trades]);

  const filtered = useMemo(() => {
    let list = trades;
    if (sideFilter !== "tous") list = list.filter((t) => t.side === sideFilter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((t) => String(t.market ?? "").toLowerCase().includes(needle) || String(t.outcome ?? "").toLowerCase().includes(needle));
    }
    return list;
  }, [trades, sideFilter, q]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string = a[sortKey] ?? 0;
      let bv: number | string = b[sortKey] ?? 0;
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * sortDir;
      return (Number(av) - Number(bv)) * sortDir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(k);
      setSortDir(-1);
    }
  }

  const totalCost = filtered.reduce((s, t) => s + Number(t.cost ?? 0), 0);
  const buyCount = filtered.filter((t) => String(t.side).toUpperCase() === "BUY").length;
  const sellCount = filtered.filter((t) => String(t.side).toUpperCase() === "SELL").length;

  // Repartition par marche (Steven 04/08) : agregation cote client des
  // transactions deja chargees -- aucun appel reseau supplementaire, juste
  // une lecture groupee de ce que /api/real-history a deja renvoye.
  const byMarket = useMemo(() => {
    const acc: Record<string, { count: number; cost: number }> = {};
    for (const t of filtered) {
      const key = String(t.market ?? "?");
      if (!acc[key]) acc[key] = { count: 0, cost: 0 };
      acc[key].count += 1;
      acc[key].cost += Number(t.cost ?? 0);
    }
    return Object.entries(acc)
      .map(([market, v]) => ({ market, ...v }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12);
  }, [filtered]);

  const headers: { key: SortKey; label: string }[] = [
    { key: "ts", label: "Date" },
    { key: "market", label: "Marche" },
    { key: "side", label: "Sens" },
    { key: "size", label: "Taille" },
    { key: "price", label: "Prix" },
    { key: "cost", label: "Cout" },
  ];

  const summary = data?.summary;
  const netByMarket: any[] = data?.net_pnl_by_market ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-300">
        Source : Polymarket data-api (lecture seule, publique, on-chain) -- c&apos;est la verite terrain, a preferer
        au PnL interne du bot en cas de divergence.
      </div>

      {summary && (
        <Card>
          <div className="mb-2 text-sm font-medium">PnL net reel (achats vs ventes + resolutions)</div>
          <p className="mb-3 text-[10.5px] leading-relaxed text-zinc-600">
            Corrige le 04/08 (Steven, &quot;eth la par ex a fait bien + que 20c de gain&quot;) : les paiements de
            resolution (REDEEM, quand une position gardee jusqu&apos;au bout GAGNE) ont un prix a 0 dans le flux brut
            Polymarket -- l&apos;ancien calcul les comptait a 0$ au lieu du vrai montant paye, sous-estimant fortement
            les gains reels. Desormais base sur le montant USDC reel de chaque evenement, resolutions incluses.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="PnL net total" value={`${summary.net_total >= 0 ? "+" : ""}${summary.net_total.toFixed(2)}$`} tone={summary.net_total >= 0 ? "up" : "down"} />
            <StatTile label="Positions gagnantes" value={summary.wins_count} tone="up" />
            <StatTile label="Gains cumules" value={`+${summary.wins_sum.toFixed(2)}$`} tone="up" />
            <StatTile label="Pertes cumulees" value={`${summary.losses_sum.toFixed(2)}$`} tone="down" />
          </div>
        </Card>
      )}

      {netByMarket.length > 0 && (
        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">PnL par position (achats + ventes + resolution), pires en premier</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/8 text-zinc-500">
                  <th className="px-2 py-1.5 font-medium">Marche</th>
                  <th className="px-2 py-1.5 font-medium">Issue</th>
                  <th className="px-2 py-1.5 font-medium">Achete</th>
                  <th className="px-2 py-1.5 font-medium">Vendu</th>
                  <th className="px-2 py-1.5 font-medium">Resolution</th>
                  <th className="px-2 py-1.5 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {netByMarket.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-b border-white/5 text-zinc-300">
                    <td className="max-w-[200px] truncate px-2 py-1.5 text-zinc-100" title={r.market}>{r.market}</td>
                    <td className="px-2 py-1.5 text-zinc-500">{r.outcome}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.buy.toFixed(2)}$</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.sell.toFixed(2)}$</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.redeem.toFixed(2)}$</td>
                    <td className={`px-2 py-1.5 tabular-nums font-medium ${r.net_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {r.net_pnl >= 0 ? "+" : ""}
                      {r.net_pnl.toFixed(2)}$
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un marche/issue..."
          className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
        />
        <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
          <option value="tous">Achats + ventes</option>
          {sides.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={load} className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">
          Rafraichir
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="text-xs text-zinc-500">Chargement de l&apos;historique on-chain...</div>
        </Card>
      ) : error ? (
        <Card className="border-red-500/20 bg-red-500/[0.06]">
          <div className="text-xs text-red-300">{error}</div>
        </Card>
      ) : trades.length === 0 ? (
        <Card>
          <div className="text-xs text-zinc-500">Aucune activite on-chain trouvee pour ce wallet.</div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Transactions" value={filtered.length} />
            <StatTile label="Achats" value={buyCount} tone="up" />
            <StatTile label="Ventes" value={sellCount} tone="down" />
            <StatTile label="Cout total (filtre)" value={`${totalCost.toFixed(2)}$`} />
          </div>

          {byMarket.length > 0 && (
            <Card>
              <div className="mb-2 text-xs font-medium text-zinc-300">Top marches par cout engage (transactions filtrees)</div>
              <div className="space-y-1.5">
                {byMarket.map((m) => {
                  const maxCost = Math.max(...byMarket.map((x) => x.cost), 0.01);
                  return (
                    <div key={m.market} className="flex items-center gap-2 text-[11px]">
                      <span className="w-40 shrink-0 truncate text-zinc-400" title={m.market}>
                        {m.market}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-sky-500/60" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right tabular-nums text-zinc-300">{m.cost.toFixed(2)}$</span>
                      <span className="w-10 shrink-0 text-right tabular-nums text-zinc-600">{m.count}x</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11.5px]">
              <thead>
                <tr className="border-b border-white/8 text-zinc-500">
                  {headers.map((h) => (
                    <th key={h.key} className="cursor-pointer select-none px-2 py-2 font-medium hover:text-zinc-300" onClick={() => toggleSort(h.key)}>
                      {h.label} {sortKey === h.key ? (sortDir === 1 ? "↑" : "↓") : ""}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-medium">Issue</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 200).map((t, i) => (
                  <tr key={i} className="border-b border-white/5 text-zinc-300 hover:bg-white/[0.02]">
                    <td className="px-2 py-2 tabular-nums text-zinc-500">{fmtTs(t.ts)}</td>
                    <td className="max-w-[220px] truncate px-2 py-2 font-medium text-zinc-100" title={t.market}>
                      {t.market}
                    </td>
                    <td className="px-2 py-2">
                      <span className={String(t.side).toUpperCase() === "BUY" ? "text-emerald-400" : "text-red-400"}>{t.side}</span>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{Number(t.size ?? 0).toFixed(2)}</td>
                    <td className="px-2 py-2 tabular-nums">{Number(t.price ?? 0).toFixed(3)}</td>
                    <td className="px-2 py-2 tabular-nums">{Number(t.cost ?? 0).toFixed(2)}$</td>
                    <td className="px-2 py-2 text-zinc-500">{t.outcome ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length > 200 && (
              <div className="mt-2 text-[10.5px] text-zinc-600">
                {sorted.length - 200} transactions supplementaires non affichees (limite d&apos;affichage 200 -- l&apos;API bot elle-meme
                plafonne a 200 transactions les plus recentes).
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
