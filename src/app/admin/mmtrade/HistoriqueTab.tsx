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
  const [side, setSide] = useState("");
  const [strat, setStrat] = useState("");
  const [minPnl, setMinPnl] = useState("");
  const [maxPnl, setMaxPnl] = useState("");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("opened_ts");
  const [sortDir, setSortDir] = useState("desc");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filtres avances (Steven 04/08, "dash massif + complet") : side/strat/
  // min_pnl/max_pnl sont deja supportes par _filter_sort_trades() cote bot
  // mais n'etaient jamais exposes dans l'UI -- champs realises pour de vrai,
  // pas des placeholders.
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "25", sort_by: sortBy, sort_dir: sortDir });
    if (symbol) params.set("symbol", symbol);
    if (mode) params.set("mode", mode);
    if (win) params.set("win", win);
    if (side) params.set("side", side);
    if (strat) params.set("strat", strat);
    if (minPnl) params.set("min_pnl", minPnl);
    if (maxPnl) params.set("max_pnl", maxPnl);
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
  }, [page, symbol, mode, win, side, strat, minPnl, maxPnl, q, fromDate, toDate, sortBy, sortDir]);

  const stats = data?.stats;
  const exportParams = new URLSearchParams({ format: "csv" });
  if (symbol) exportParams.set("symbol", symbol);
  if (mode) exportParams.set("mode", mode);
  if (win) exportParams.set("win", win);
  if (side) exportParams.set("side", side);
  if (strat) exportParams.set("strat", strat);
  if (minPnl) exportParams.set("min_pnl", minPnl);
  if (maxPnl) exportParams.set("max_pnl", maxPnl);
  if (q) exportParams.set("q", q);
  if (fromDate) exportParams.set("from_date", fromDate);
  if (toDate) exportParams.set("to_date", toDate);

  const hasActiveFilters = !!(fromDate || toDate || q || symbol || mode || win || side || strat || minPnl || maxPnl);

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
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
            showAdvanced ? "bg-white/15 text-zinc-100" : "bg-white/[0.03] text-zinc-500 hover:bg-white/8"
          }`}
        >
          Filtres avances {showAdvanced ? "▾" : "▸"}
        </button>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setQ("");
              setFromDate("");
              setToDate("");
              setSymbol("");
              setMode("");
              setWin("");
              setSide("");
              setStrat("");
              setMinPnl("");
              setMaxPnl("");
              setPage(1);
            }}
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

      {showAdvanced && (
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
              Sens
              <select
                value={side}
                onChange={(e) => { setSide(e.target.value); setPage(1); }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200"
              >
                <option value="">Up + Down</option>
                <option value="up">Up seulement</option>
                <option value="down">Down seulement</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
              Strategie
              <input
                value={strat}
                onChange={(e) => { setStrat(e.target.value); setPage(1); }}
                placeholder="ex. risk_free, opportunity..."
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
              PnL minimum ($)
              <input
                type="number"
                step="0.01"
                value={minPnl}
                onChange={(e) => { setMinPnl(e.target.value); setPage(1); }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
              PnL maximum ($)
              <input
                type="number"
                step="0.01"
                value={maxPnl}
                onChange={(e) => { setMaxPnl(e.target.value); setPage(1); }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100"
              />
            </label>
          </div>
          <div className="mt-2 text-[10.5px] text-zinc-600">
            Ces 4 filtres etaient deja supportes cote bot (_filter_sort_trades) mais jamais exposes dans
            l&apos;interface avant cette iteration.
          </div>
        </Card>
      )}

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
