"use client";
import { useEffect, useState } from "react";

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

const SORT_OPTIONS = [
  ["opened_ts", "Date"],
  ["pnl", "PnL"],
  ["cost", "Cout"],
  ["filled_shares", "Parts"],
  ["entry_price", "Prix entree"],
  ["symbol", "Symbole"],
] as const;

export function HistoriqueTab({ symbols }: { symbols: string[] }) {
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState("");
  const [mode, setMode] = useState("");
  const [win, setWin] = useState("");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("opened_ts");
  const [sortDir, setSortDir] = useState("desc");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "25", sort_by: sortBy, sort_dir: sortDir });
    if (symbol) params.set("symbol", symbol);
    if (mode) params.set("mode", mode);
    if (win) params.set("win", win);
    if (q) params.set("q", q);
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    const t = setTimeout(() => {
      fetch(`/admin/mmtrade/trades?${params}`)
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false));
    }, q ? 300 : 0); // debounce sur la recherche texte, pas sur les autres filtres
    return () => clearTimeout(t);
  }, [page, symbol, mode, win, q, fromDate, toDate, sortBy, sortDir]);

  const stats = data?.stats;
  const exportParams = new URLSearchParams({ format: "csv" });
  if (symbol) exportParams.set("symbol", symbol);
  if (mode) exportParams.set("mode", mode);
  if (win) exportParams.set("win", win);
  if (q) exportParams.set("q", q);
  if (fromDate) exportParams.set("from_date", fromDate);
  if (toDate) exportParams.set("to_date", toDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Rechercher (slug, cote...)"
          className="min-w-[160px] flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
        />
        <select value={symbol} onChange={(e) => { setSymbol(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
          <option value="">Tous symboles</option>
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
          <option value="">Reel + paper</option>
          <option value="real">Reel seulement</option>
          <option value="paper">Paper seulement</option>
        </select>
        <select value={win} onChange={(e) => { setWin(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
          <option value="">Gains + pertes</option>
          <option value="true">Gains seulement</option>
          <option value="false">Pertes seulement</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          Du
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200" />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          Au
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200" />
        </label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
          {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>Trier : {l}</option>)}
        </select>
        <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
          <option value="desc">Descendant</option>
          <option value="asc">Ascendant</option>
        </select>
        {(fromDate || toDate || q || symbol || mode || win) && (
          <button
            onClick={() => { setQ(""); setFromDate(""); setToDate(""); setSymbol(""); setMode(""); setWin(""); setPage(1); }}
            className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-400 hover:bg-white/10"
          >
            Reinitialiser
          </button>
        )}
        {data?.total !== undefined && (
          <a
            href={`/admin/mmtrade/trades/export?${exportParams}`}
            className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20"
          >
            Exporter CSV
          </a>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card><div className="text-[11px] text-zinc-500">Total</div><div className="mt-1 text-lg font-semibold tabular-nums">{stats.total}</div></Card>
          <Card><div className="text-[11px] text-zinc-500">Win rate</div><div className="mt-1 text-lg font-semibold tabular-nums">{stats.win_rate}%</div></Card>
          <Card><div className="text-[11px] text-zinc-500">PnL total</div><div className="mt-1 text-lg font-semibold tabular-nums"><Money v={stats.total_pnl} /></div></Card>
          <Card><div className="text-[11px] text-zinc-500">Meilleur / pire</div><div className="mt-1 text-sm font-semibold tabular-nums"><Money v={stats.best_pnl} /> / <Money v={stats.worst_pnl} /></div></Card>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="text-xs text-zinc-500">Chargement...</div>
        ) : !data?.trades?.length ? (
          <div className="text-xs text-zinc-500">Aucun trade pour ces filtres.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-zinc-500">
                  <tr><th className="pb-1 pr-3">Symbole</th><th className="pb-1 pr-3">Mode</th><th className="pb-1 pr-3">Cote</th><th className="pb-1 pr-3">Strategie</th><th className="pb-1 pr-3">PnL</th><th className="pb-1">Resultat</th></tr>
                </thead>
                <tbody className="text-zinc-300">
                  {data.trades.map((t: any, i: number) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-1 pr-3 font-medium">{t.symbol ?? t._market_key}</td>
                      <td className="py-1 pr-3 text-zinc-500">{t.mode ?? "-"}</td>
                      <td className="py-1 pr-3">{t.side ?? "-"}</td>
                      <td className="py-1 pr-3 text-zinc-500">{t.strat ?? "-"}</td>
                      <td className="py-1 pr-3 tabular-nums"><Money v={t.pnl} /></td>
                      <td className="py-1"><span className={t.win ? "text-emerald-400" : "text-red-400"}>{t.win ? "gain" : "perte"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Page {data.page} / {data.pages} ({data.total} trades)</span>
              <div className="flex gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full bg-white/5 px-3 py-1 disabled:opacity-30">Precedent</button>
                <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-full bg-white/5 px-3 py-1 disabled:opacity-30">Suivant</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
