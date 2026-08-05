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

const HOUR_OPTIONS = [6, 12, 24, 48, 72];

function fmtBucketLabel(bucketStart: number) {
  const ms = bucketStart > 1e12 ? bucketStart : bucketStart * 1000;
  try {
    const d = new Date(ms);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(bucketStart);
  }
}

type Bucket = {
  bucket_start: number;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  by_symbol: Record<string, number>;
  by_strat: Record<string, number>;
  by_resolved_by: Record<string, number>;
};

function BreakdownList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => a[1] - b[1]);
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ${
              v >= 0 ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" : "bg-red-500/10 text-red-300 ring-red-500/20"
            }`}
          >
            {k} {v >= 0 ? "+" : ""}
            {v.toFixed(2)}$
          </span>
        ))}
      </div>
    </div>
  );
}

// Historique long terme (Steven 05/08, "il faut que tu puisse voir + de
// historique, genre resumer plusieurs heures") : consomme /api/history-summary
// (nouveau cote bot), reconstruit depuis les trades deja en memoire pour toute
// la session -- contrairement au Journal (limite a ~40min de journal texte
// roulant), cet onglet couvre plusieurs heures d'un coup, avec ventilation
// par symbole/strategie/raison de sortie a chaque tranche horaire.
export function HistorySummaryTab() {
  const [hours, setHours] = useState(12);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function load(h: number) {
    setLoading(true);
    fetch(`/admin/mmtrade/history-summary?hours=${h}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setError(d.error);
        else {
          setError(null);
          setData(d);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const buckets: Bucket[] = data?.buckets ?? [];
  const summary = data?.summary;

  const maxAbsPnl = useMemo(() => Math.max(1, ...buckets.map((b) => Math.abs(b.pnl))), [buckets]);

  function toggleExpand(ts: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-300">
        Reconstruit depuis les trades deja en memoire (pas le journal texte, limite a ~40min) -- couvre plusieurs
        heures d&apos;un coup, dispo immediatement.
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {HOUR_OPTIONS.map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              hours === h ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/8"
            }`}
          >
            {h}h
          </button>
        ))}
        <button onClick={() => load(hours)} className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">
          Rafraichir
        </button>
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/[0.06]">
          <div className="text-xs text-red-300">{error}</div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="text-xs text-zinc-500">Chargement...</div>
        </Card>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label={`Trades (${hours}h)`} value={summary.total_trades} />
              <StatTile label="Win rate" value={summary.win_rate_pct !== null ? `${summary.win_rate_pct}%` : "-"} />
              <StatTile
                label="PnL total"
                value={`${summary.total_pnl >= 0 ? "+" : ""}${summary.total_pnl.toFixed(2)}$`}
                tone={summary.total_pnl >= 0 ? "up" : "down"}
              />
              <StatTile label="Tranches horaires" value={buckets.length} />
            </div>
          )}

          {buckets.length === 0 ? (
            <Card>
              <div className="text-xs text-zinc-500">Aucun trade sur cette periode.</div>
            </Card>
          ) : (
            <Card>
              <div className="mb-2 text-xs font-medium text-zinc-300">PnL par heure (plus recent en bas)</div>
              <div className="space-y-2">
                {[...buckets].reverse().map((b) => {
                  const isOpen = expanded.has(b.bucket_start);
                  const barWidthPct = (Math.abs(b.pnl) / maxAbsPnl) * 100;
                  const winRate = b.trades > 0 ? Math.round((b.wins / b.trades) * 100) : 0;
                  return (
                    <div key={b.bucket_start} className="rounded-lg border border-white/5 bg-white/[0.015] p-2">
                      <button onClick={() => toggleExpand(b.bucket_start)} className="flex w-full items-center gap-3 text-left">
                        <span className="w-28 shrink-0 text-[11px] text-zinc-500">{fmtBucketLabel(b.bucket_start)}</span>
                        <div className="flex h-4 flex-1 items-center">
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
                            <div
                              className={`h-full rounded-full ${b.pnl >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                              style={{ width: `${Math.max(2, barWidthPct)}%` }}
                            />
                          </div>
                        </div>
                        <span className={`w-20 shrink-0 text-right text-[12px] font-semibold tabular-nums ${b.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {b.pnl >= 0 ? "+" : ""}
                          {b.pnl.toFixed(2)}$
                        </span>
                        <span className="w-24 shrink-0 text-right text-[10.5px] text-zinc-500">
                          {b.trades} trades · {winRate}%
                        </span>
                        <span className="w-4 shrink-0 text-center text-zinc-600">{isOpen ? "▾" : "▸"}</span>
                      </button>
                      {isOpen && (
                        <div className="mt-3 space-y-2 border-t border-white/5 pt-2 pl-1">
                          <BreakdownList title="Par symbole" data={b.by_symbol} />
                          <BreakdownList title="Par strategie" data={b.by_strat} />
                          <BreakdownList title="Par raison de sortie" data={b.by_resolved_by} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
