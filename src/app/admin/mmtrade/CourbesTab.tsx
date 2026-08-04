"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "./Sparkline";
import { UpDownChart } from "./UpDownChart";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

const RANGES = [
  { label: "5 min", secs: 300 },
  { label: "30 min", secs: 1800 },
  { label: "1 h", secs: 3600 },
  { label: "6 h", secs: 21600 },
];

function pointStats(points: { ts: number; price: number }[]) {
  if (!points.length) return null;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.min(1e18, Math.max(...prices));
  const first = prices[0];
  const last = prices[prices.length - 1];
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const rangePct = min ? ((max - min) / min) * 100 : 0;
  return { min, max, first, last, changePct, rangePct, n: points.length };
}

// Etendu (Steven 04/08, "dash massif + complet") : chaque courbe zoomable
// affiche desormais un mini-panneau de stats calcule client-side a partir
// des points deja recus (min/max/variation %) -- aucune donnee fictive,
// juste une lecture agregee de ce que /api/curve renvoie deja. Ajout d'un
// tableau de comparaison entre symboles pour une vue synthetique.
export function CourbesTab({ priceLogBySymbol }: { priceLogBySymbol: Record<string, Record<string, any[]>> }) {
  const [rangeSecs, setRangeSecs] = useState(1800);
  const [curves, setCurves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      fetch(`/admin/mmtrade/curve?range=${rangeSecs}`)
        .then((r) => r.json())
        .then((d) => !cancelled && setCurves(Array.isArray(d) ? d : []))
        .finally(() => !cancelled && setLoading(false));
    };
    load();
    if (!autoRefresh) return () => { cancelled = true; };
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [rangeSecs, autoRefresh]);

  const enriched = useMemo(
    () =>
      curves.map((c: any) => {
        const pts = (c.points ?? []).map((p: any) => ({ ts: p.ts, price: p.price }));
        return { ...c, pts, stats: pointStats(pts) };
      }),
    [curves]
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Prix sous-jacent (zoomable)</div>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-emerald-500" />
            auto-refresh 15s
          </label>
        </div>
        <div className="mb-3 flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.secs}
              onClick={() => setRangeSecs(r.secs)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                rangeSecs === r.secs ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/8"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {enriched.length > 1 && (
          <Card className="mb-3">
            <div className="mb-2 text-xs font-medium text-zinc-300">Comparaison des symboles sur la fenetre selectionnee</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-white/8 text-zinc-500">
                    <th className="px-2 py-1.5 font-medium">Symbole</th>
                    <th className="px-2 py-1.5 font-medium">Dernier</th>
                    <th className="px-2 py-1.5 font-medium">Variation</th>
                    <th className="px-2 py-1.5 font-medium">Amplitude</th>
                    <th className="px-2 py-1.5 font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((c) => (
                    <tr key={c.symbol} className="border-b border-white/5 text-zinc-300">
                      <td className="px-2 py-1.5 font-medium text-zinc-100">{c.symbol}</td>
                      <td className="px-2 py-1.5 tabular-nums">{c.stats ? c.stats.last.toFixed(4) : "-"}</td>
                      <td className={`px-2 py-1.5 tabular-nums ${c.stats && c.stats.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {c.stats ? `${c.stats.changePct >= 0 ? "+" : ""}${c.stats.changePct.toFixed(3)}%` : "-"}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-zinc-400">{c.stats ? `${c.stats.rangePct.toFixed(3)}%` : "-"}</td>
                      <td className="px-2 py-1.5 tabular-nums text-zinc-500">{c.stats?.n ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loading && curves.length === 0 && (
            <Card>
              <div className="text-xs text-zinc-500">Chargement...</div>
            </Card>
          )}
          {enriched.map((c) => (
            <Card key={c.symbol}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">{c.symbol}</span>
                {c.stats && (
                  <span className={`text-[11px] tabular-nums ${c.stats.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {c.stats.changePct >= 0 ? "+" : ""}
                    {c.stats.changePct.toFixed(3)}%
                  </span>
                )}
              </div>
              <Sparkline symbol={c.symbol} points={c.pts} strike={c.strikes?.[c.strikes.length - 1]?.strike} />
              {c.stats && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10.5px] text-zinc-500">
                  <div>
                    <div className="text-zinc-300 tabular-nums">{c.stats.min.toFixed(2)}</div>min
                  </div>
                  <div>
                    <div className="text-zinc-300 tabular-nums">{c.stats.max.toFixed(2)}</div>max
                  </div>
                  <div>
                    <div className="text-zinc-300 tabular-nums">{c.stats.rangePct.toFixed(3)}%</div>amplitude
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Prix des contrats Up / Down (marche en cours)</div>
        <div className="mb-3 text-[11px] text-zinc-500">Deja en direct (flux SSE) -- pas de zoom ici, fenetre de marche de 5 min.</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(priceLogBySymbol).map(([sym, bySlug]) => {
            const slugs = Object.keys(bySlug);
            const lastSlug = slugs[slugs.length - 1];
            if (!lastSlug) return null;
            return (
              <Card key={sym}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">{sym}</span>
                  <span className="text-[10.5px] text-zinc-600">{slugs.length} marche(s) en memoire</span>
                </div>
                <UpDownChart slug={lastSlug} points={bySlug[lastSlug]} />
              </Card>
            );
          })}
          {Object.keys(priceLogBySymbol).length === 0 && (
            <Card>
              <div className="text-xs text-zinc-500">Aucun marche actif pour l&apos;instant.</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
