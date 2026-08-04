"use client";
import { useMemo, useRef, useState } from "react";

type Point = { ts: number; price: number };

// Une seule serie par graphique (le prix d'UN symbole) : pas de legende requise
// (references/marks-and-anatomy.md), la couleur suit l'identite (accent unique
// coherent avec le reste du dashboard), pas le rang. 2px de trait, marqueur de
// fin >=8px avec anneau 2px couleur de surface, valeur directement labellisee
// au point final, grille en hairline recessive. Crosshair + tooltip au survol
// (interaction.md : "ship a crosshair+tooltip on line/area par defaut").
export function Sparkline({ symbol, points, strike }: { symbol: string; points: Point[]; strike?: number }) {
  const width = 320;
  const height = 96;
  const pad = 10;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { path, xs, ys, min, max, last } = useMemo(() => {
    if (!points.length) return { path: "", xs: [] as number[], ys: [] as number[], min: 0, max: 0, last: null as Point | null };
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const t0 = points[0].ts;
    const t1 = points[points.length - 1].ts || t0 + 1;
    const xs = points.map((p) => pad + ((p.ts - t0) / (t1 - t0 || 1)) * (width - pad * 2));
    const ys = points.map((p) => {
      const norm = max === min ? 0.5 : (p.price - min) / (max - min);
      return height - pad - norm * (height - pad * 2);
    });
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    return { path, xs, ys, min, max, last: points[points.length - 1] };
  }, [points]);

  if (!points.length) {
    return <div className="flex h-24 items-center justify-center text-[11px] text-zinc-600">pas de donnees</div>;
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    xs.forEach((x, i) => {
      const d = Math.abs(x - mx);
      if (d < best) { best = d; nearest = i; }
    });
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

  // tooltip flottant positionne pres du crosshair (interaction.md : hit
  // targets + tooltip par defaut) -- clamp pour ne jamais deborder du SVG.
  const tooltipX = hover !== null ? Math.min(Math.max(xs[hover], 34), width - 34) : 0;
  const tooltipAbove = hover !== null && ys[hover] > height / 2;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="font-medium text-zinc-300">{symbol}</span>
        <span className="tabular-nums">{hp ? hp.price.toFixed(3) : last?.price.toFixed(3)}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* grille : une seule ligne de base, hairline recessive */}
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {strike && max !== min && (
          <line
            x1={pad}
            y1={height - pad - ((strike - min) / (max - min)) * (height - pad * 2)}
            x2={width - pad}
            y2={height - pad - ((strike - min) / (max - min)) * (height - pad * 2)}
            stroke="rgba(251,191,36,0.35)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        )}
        <path d={path} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* marqueur de fin : >=8px (r=4 -> diametre 8), anneau 2px couleur de surface */}
        {xs.length > 0 && (
          <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={4} fill="#34d399" stroke="#0a0a0a" strokeWidth={2} />
        )}
        {hover !== null && (
          <>
            <line x1={xs[hover]} y1={pad} x2={xs[hover]} y2={height - pad} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            <circle cx={xs[hover]} cy={ys[hover]} r={4} fill="#34d399" stroke="#0a0a0a" strokeWidth={2} />
            <g transform={`translate(${tooltipX}, ${tooltipAbove ? ys[hover] - 34 : ys[hover] + 10})`}>
              <rect x={-32} y={0} width={64} height={24} rx={6} fill="#0a0a0d" stroke="rgba(255,255,255,0.12)" />
              <text x={0} y={10} textAnchor="middle" className="fill-zinc-100" style={{ fontSize: 9, fontWeight: 600 }}>
                {points[hover].price.toFixed(3)}
              </text>
              <text x={0} y={20} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 7.5 }}>
                {fmtTime(points[hover].ts)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
