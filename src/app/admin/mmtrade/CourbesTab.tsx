"use client";
import { useEffect, useState } from "react";
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

// price_log par symbole : {symbol: {slug: [{ts, Up, Down, comb_ask}, ...]}}
export function CourbesTab({ priceLogBySymbol }: { priceLogBySymbol: Record<string, Record<string, any[]>> }) {
  const [rangeSecs, setRangeSecs] = useState(1800);
  const [curves, setCurves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/admin/mmtrade/curve?range=${rangeSecs}`)
      .then((r) => r.json())
      .then((d) => setCurves(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [rangeSecs]);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm font-medium">Prix sous-jacent (zoomable)</div>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loading && curves.length === 0 && <Card><div className="text-xs text-zinc-500">Chargement...</div></Card>}
          {curves.map((c: any) => (
            <Card key={c.symbol}>
              <Sparkline symbol={c.symbol} points={(c.points ?? []).map((p: any) => ({ ts: p.ts, price: p.price }))} strike={c.strikes?.[c.strikes.length - 1]?.strike} />
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
                <div className="mb-1 text-xs font-semibold text-zinc-300">{sym}</div>
                <UpDownChart slug={lastSlug} points={bySlug[lastSlug]} />
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
