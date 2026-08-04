"use client";
import { useMemo, useRef, useState } from "react";

type Pt = { ts: number; Up?: number; Down?: number; comb_ask?: number };

// 2 series (Up/Down) : legende obligatoire (>=2 series), paire validee
// colorblind-safe (dataviz skill, script valide : ΔE 19.2 protan / 29.0
// normal-vision). Couleur suit l'identite (Up vs Down), jamais le rang.
const UP_COLOR = "#3987e5";
const DOWN_COLOR = "#e66767";

export function UpDownChart({ slug, points }: { slug: string; points: Pt[] }) {
  const width = 320;
  const height = 110;
  const pad = 10;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { upPath, downPath, xs, upYs, downYs, last } = useMemo(() => {
    if (!points.length) return { upPath: "", downPath: "", xs: [] as number[], upYs: [] as number[], downYs: [] as number[], last: null as Pt | null };
    const t0 = points[0].ts;
    const t1 = points[points.length - 1].ts || t0 + 1;
    const xs = points.map((p) => pad + ((p.ts - t0) / (t1 - t0 || 1)) * (width - pad * 2));
    // echelle 0..1 fixe (prix de contrat Polymarket, toujours entre 0 et 1)
    const y = (v: number) => height - pad - v * (height - pad * 2);
    const upYs = points.map((p) => y(p.Up ?? 0));
    const downYs = points.map((p) => y(p.Down ?? 0));
    const line = (ys: number[]) => xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    return { upPath: line(upYs), downPath: line(downYs), xs, upYs, downYs, last: points[points.length - 1] };
  }, [points]);

  if (!points.length) {
    return <div className="flex h-28 items-center justify-center text-[11px] text-zinc-600">pas de donnees</div>;
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0, best = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(x - mx); if (d < best) { best = d; nearest = i; } });
    setHover(nearest);
  };
  const hp = hover !== null ? points[hover] : null;

  function fmtTime(ts: number) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    try {
      return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return String(ts);
    }
  }

  const tooltipX = hover !== null ? Math.min(Math.max(xs[hover], 40), width - 40) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="truncate font-medium text-zinc-300">{slug}</span>
        {last?.comb_ask !== undefined && <span className="tabular-nums text-zinc-400">comb {(hp?.comb_ask ?? last.comb_ask).toFixed(3)}</span>}
      </div>
      {/* legende directe -- 2 series, couleur + libelle, jamais couleur seule */}
      <div className="mb-1 flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-1 text-zinc-400"><span className="h-2 w-2 rounded-full" style={{ background: UP_COLOR }} />Up {(hp?.Up ?? last?.Up ?? 0).toFixed(3)}</span>
        <span className="flex items-center gap-1 text-zinc-400"><span className="h-2 w-2 rounded-full" style={{ background: DOWN_COLOR }} />Down {(hp?.Down ?? last?.Down ?? 0).toFixed(3)}</span>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        <path d={upPath} fill="none" stroke={UP_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={downPath} fill="none" stroke={DOWN_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xs.length > 0 && (
          <>
            <circle cx={xs[xs.length - 1]} cy={upYs[upYs.length - 1]} r={4} fill={UP_COLOR} stroke="#0a0a0a" strokeWidth={2} />
            <circle cx={xs[xs.length - 1]} cy={downYs[downYs.length - 1]} r={4} fill={DOWN_COLOR} stroke="#0a0a0a" strokeWidth={2} />
          </>
        )}
        {hover !== null && hp && (
          <>
            <line x1={xs[hover]} y1={pad} x2={xs[hover]} y2={height - pad} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            <circle cx={xs[hover]} cy={upYs[hover]} r={3.5} fill={UP_COLOR} stroke="#0a0a0a" strokeWidth={1.5} />
            <circle cx={xs[hover]} cy={downYs[hover]} r={3.5} fill={DOWN_COLOR} stroke="#0a0a0a" strokeWidth={1.5} />
            <g transform={`translate(${tooltipX}, ${pad})`}>
              <rect x={-38} y={0} width={76} height={30} rx={6} fill="#0a0a0d" stroke="rgba(255,255,255,0.12)" />
              <text x={0} y={11} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600, fill: UP_COLOR }}>
                Up {(hp.Up ?? 0).toFixed(3)}
              </text>
              <text x={0} y={20} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600, fill: DOWN_COLOR }}>
                Down {(hp.Down ?? 0).toFixed(3)}
              </text>
              <text x={0} y={28} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 7 }}>
                {fmtTime(hp.ts)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
