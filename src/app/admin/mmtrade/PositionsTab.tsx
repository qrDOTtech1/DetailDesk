"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "./Sparkline";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function fmtAge(openedTs: number | undefined) {
  if (!openedTs) return "-";
  const ms = openedTs > 1e12 ? openedTs : openedTs * 1000;
  const secs = Math.max(0, (Date.now() - ms) / 1000);
  if (secs < 60) return `${Math.floor(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}min ${Math.floor(secs % 60)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}min`;
}

function positionOpenedTs(p: any): number | undefined {
  const first = (p.price_log ?? [])[0];
  return first?.ts;
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{value}</div>
      {sub && <div className="mt-0.5 text-[10.5px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function BreakdownBar({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const palette = ["#3987e5", "#e66767", "#34d399", "#fbbf24", "#a78bfa", "#f472b6", "#38bdf8"];
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-zinc-400">{title}</div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        {entries.map(([k, v], i) => (
          <div key={k} title={`${k}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: palette[i % palette.length] }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-zinc-500">
        {entries.map(([k, v], i) => (
          <span key={k} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette[i % palette.length] }} />
            {k} <span className="tabular-nums text-zinc-300">{v}</span>
          </span>
        ))}
        {entries.length === 0 && <span className="text-zinc-600">aucune donnee</span>}
      </div>
    </div>
  );
}

type SortKey = "sym" | "side" | "mode" | "cost" | "shares" | "entry" | "strat" | "age";

// Positions ouvertes deja live (snapshot pousse par SSE) : chaque position
// porte son propre price_log (Steven 04/08, "courbe en direct evolution
// position ouverte") -- alimente par le meme _log_position_prices() qui
// tourne deja cote bot, aucun changement bot necessaire.
//
// Etendu (Steven 04/08, "dash massif + complet") : agregats by_mode/by_symbol/
// by_side via /api/positions-stats (deja expose cote bot, jamais surface cote
// dash avant), + vue tableau triable en plus des cartes avec sparkline.
export function PositionsTab({ positions }: { positions: any[] }) {
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [view, setView] = useState<"cartes" | "tableau">("cartes");
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [symbolFilter, setSymbolFilter] = useState<string>("tous");
  const [, forceAgeTick] = useState(0);

  // Rafraichit l'age affiche des positions toutes les 10s (Steven 04/08) --
  // sans ca "ouvert il y a 2min" resterait fige a la valeur du premier
  // rendu tant qu'aucun autre push SSE ne survient.
  useEffect(() => {
    const id = setInterval(() => forceAgeTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/admin/mmtrade/positions-stats", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d?.error) setStatsError(d.error);
          else setStats(d);
        })
        .catch((e) => !cancelled && setStatsError(String(e)));
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const symbols = useMemo(() => Array.from(new Set(positions.map((p) => p.__sym))).sort(), [positions]);

  const filtered = useMemo(
    () => (symbolFilter === "tous" ? positions : positions.filter((p) => p.__sym === symbolFilter)),
    [positions, symbolFilter]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "sym":
          av = a.__sym ?? "";
          bv = b.__sym ?? "";
          break;
        case "side":
          av = a.side ?? "";
          bv = b.side ?? "";
          break;
        case "mode":
          av = a.mode ?? "";
          bv = b.mode ?? "";
          break;
        case "cost":
          av = Number(a.cost ?? 0);
          bv = Number(b.cost ?? 0);
          break;
        case "shares":
          av = Number(a.filled_shares ?? 0);
          bv = Number(b.filled_shares ?? 0);
          break;
        case "entry":
          av = Number(a.entry_price ?? 0);
          bv = Number(b.entry_price ?? 0);
          break;
        case "strat":
          av = a.strat ?? "";
          bv = b.strat ?? "";
          break;
        case "age":
          av = positionOpenedTs(a) ?? 0;
          bv = positionOpenedTs(b) ?? 0;
          break;
      }
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * sortDir;
      }
      return (av - bv) * sortDir;
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

  const totalCost = filtered.reduce((s, p) => s + Number(p.cost ?? 0), 0);
  const totalShares = filtered.reduce((s, p) => s + Number(p.filled_shares ?? 0), 0);
  const avgEntry = filtered.length ? filtered.reduce((s, p) => s + Number(p.entry_price ?? 0), 0) / filtered.length : 0;

  const header = (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Positions ouvertes -- vue d&apos;ensemble</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView("cartes")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${view === "cartes" ? "bg-white/15 text-zinc-100" : "bg-white/[0.03] text-zinc-500 hover:bg-white/8"}`}
          >
            Cartes
          </button>
          <button
            onClick={() => setView("tableau")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${view === "tableau" ? "bg-white/15 text-zinc-100" : "bg-white/[0.03] text-zinc-500 hover:bg-white/8"}`}
          >
            Tableau
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Positions" value={filtered.length} sub={`sur ${positions.length} total`} />
        <StatTile label="Capital engage" value={`${totalCost.toFixed(2)}$`} />
        <StatTile label="Parts totales" value={totalShares.toFixed(2)} />
        <StatTile label="Prix d'entree moyen" value={avgEntry.toFixed(3)} />
      </div>

      {statsError && (
        <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          Statistiques serveur indisponibles ({statsError}) -- agregats calcules localement a la place.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BreakdownBar title="Par symbole" data={stats?.by_symbol ?? Object.fromEntries(symbols.map((s) => [s, positions.filter((p) => p.__sym === s).length]))} />
        <BreakdownBar
          title="Par mode"
          data={
            stats?.by_mode ??
            positions.reduce((acc: Record<string, number>, p) => {
              acc[p.mode ?? "?"] = (acc[p.mode ?? "?"] ?? 0) + 1;
              return acc;
            }, {})
          }
        />
        <BreakdownBar
          title="Up vs Down"
          data={
            stats?.by_side ??
            positions.reduce((acc: Record<string, number>, p) => {
              acc[p.side ?? "?"] = (acc[p.side ?? "?"] ?? 0) + 1;
              return acc;
            }, {})
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-zinc-500">Filtrer :</span>
        <button
          onClick={() => setSymbolFilter("tous")}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${symbolFilter === "tous" ? "bg-white/15 text-zinc-100" : "bg-white/[0.03] text-zinc-500 hover:bg-white/8"}`}
        >
          tous
        </button>
        {symbols.map((s) => (
          <button
            key={s}
            onClick={() => setSymbolFilter(s)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${symbolFilter === s ? "bg-white/15 text-zinc-100" : "bg-white/[0.03] text-zinc-500 hover:bg-white/8"}`}
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  );

  if (positions.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <div className="text-xs text-zinc-500">Aucune position ouverte en ce moment.</div>
        </Card>
      </div>
    );
  }

  const sortHeaders: { key: SortKey; label: string }[] = [
    { key: "sym", label: "Symbole" },
    { key: "side", label: "Sens" },
    { key: "mode", label: "Mode" },
    { key: "strat", label: "Strategie" },
    { key: "entry", label: "Entree" },
    { key: "shares", label: "Parts" },
    { key: "cost", label: "Engage" },
    { key: "age", label: "Ouverte depuis" },
  ];

  return (
    <div className="space-y-4">
      {header}

      {view === "tableau" ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-white/8 text-zinc-500">
                {sortHeaders.map((h) => (
                  <th key={h.key} className="cursor-pointer select-none px-2 py-2 font-medium hover:text-zinc-300" onClick={() => toggleSort(h.key)}>
                    {h.label} {sortKey === h.key ? (sortDir === 1 ? "↑" : "↓") : ""}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">Palier TP</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={i} className="border-b border-white/5 text-zinc-300 hover:bg-white/[0.02]">
                  <td className="px-2 py-2 font-medium text-zinc-100">{p.__sym}</td>
                  <td className="px-2 py-2">
                    <span className={p.side === "Up" ? "text-emerald-400" : "text-red-400"}>{p.side}</span>
                  </td>
                  <td className="px-2 py-2 text-zinc-500">{p.mode ?? "-"}</td>
                  <td className="px-2 py-2 text-zinc-500">{p.strat ?? "-"}</td>
                  <td className="px-2 py-2 tabular-nums">{Number(p.entry_price ?? 0).toFixed(3)}</td>
                  <td className="px-2 py-2 tabular-nums">{Number(p.filled_shares ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-2 tabular-nums">{Number(p.cost ?? 0).toFixed(2)}$</td>
                  <td className="px-2 py-2 tabular-nums text-zinc-500">{fmtAge(positionOpenedTs(p))}</td>
                  <td className="px-2 py-2 tabular-nums text-zinc-500">{p.pnl_tp_stage ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((p: any, i: number) => {
            const pts = (p.price_log ?? []).map((pt: any) => ({ ts: pt.ts, price: pt.price }));
            return (
              <Card key={i}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">
                    {p.__sym} · {p.side}
                  </span>
                  <span className="text-zinc-500">{p.strat ?? "-"}</span>
                </div>
                <Sparkline symbol={`entree ${Number(p.entry_price ?? 0).toFixed(3)}`} points={pts} strike={p.entry_price} />
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px] text-zinc-400">
                  <div>
                    <div className="text-zinc-200 tabular-nums">{Number(p.filled_shares ?? 0).toFixed(2)}</div>parts (sizing reel)
                  </div>
                  <div>
                    <div className="text-zinc-200 tabular-nums">{Number(p.cost ?? 0).toFixed(2)}$</div>engage
                  </div>
                  <div>
                    <div className="text-zinc-200 tabular-nums">{p.pnl_tp_stage ?? 0}</div>palier TP
                  </div>
                  <div>
                    <div className="text-zinc-200 tabular-nums">{fmtAge(positionOpenedTs(p))}</div>ouverte depuis
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
