"use client";
import { Sparkline } from "./Sparkline";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

// Positions ouvertes deja live (snapshot pousse par SSE) : chaque position
// porte son propre price_log (Steven 04/08, "courbe en direct evolution
// position ouverte") -- alimente par le meme _log_position_prices() qui
// tourne deja cote bot, aucun changement bot necessaire.
export function PositionsTab({ positions }: { positions: any[] }) {
  if (positions.length === 0) {
    return <Card><div className="text-xs text-zinc-500">Aucune position ouverte en ce moment.</div></Card>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {positions.map((p: any, i: number) => {
        const pts = (p.price_log ?? []).map((pt: any) => ({ ts: pt.ts, price: pt.price }));
        return (
          <Card key={i}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200">{p.__sym} · {p.side}</span>
              <span className="text-zinc-500">{p.strat ?? "-"}</span>
            </div>
            <Sparkline symbol={`entree ${Number(p.entry_price ?? 0).toFixed(3)}`} points={pts} strike={p.entry_price} />
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-400">
              <div><div className="text-zinc-200 tabular-nums">{Number(p.filled_shares ?? 0).toFixed(2)}</div>parts (sizing reel)</div>
              <div><div className="text-zinc-200 tabular-nums">{Number(p.cost ?? 0).toFixed(2)}$</div>engage</div>
              <div><div className="text-zinc-200 tabular-nums">{p.pnl_tp_stage ?? 0}</div>palier TP</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
