"use client";
import { useEffect, useRef, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

// Cadran radial style montre de luxe (Steven 04/08, "horloge si belle qu'on
// peut la laisser en plein ecran... mieux qu'une Omega ou une Rolex") : SVG
// pur, pas de librairie externe, anneau qui se vide au fil des 300 secondes
// du cycle -- valeurs 100% reelles (seconds_left/strike/price de /api/clock),
// zero decoration fictive.
function WatchDial({
  label,
  secondsLeft,
  strike,
  price,
  size = 220,
}: {
  label: string;
  secondsLeft: number;
  strike: number;
  price: number;
  size?: number;
}) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, secondsLeft / 300));
  const dashOffset = circumference * (1 - pct);
  const leaning = price >= strike ? "Up" : "Down";
  const deltaPct = strike ? ((price - strike) / strike) * 100 : 0;
  const inDecisionZone = secondsLeft <= 90 && secondsLeft >= 6;
  const ringColor = inDecisionZone ? "#34d399" : leaning === "Up" ? "#3987e5" : "#e66767";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* cadran exterieur */}
        <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        {/* graduations (60, comme une montre) */}
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
          const isMajor = i % 5 === 0;
          const rOuter = r + 8;
          const rInner = isMajor ? r + 2 : r + 5;
          const x1 = cx + rOuter * Math.cos(angle);
          const y1 = cy + rOuter * Math.sin(angle);
          const x2 = cx + rInner * Math.cos(angle);
          const y2 = cy + rInner * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={isMajor ? 1.5 : 0.75} />;
        })}
        {/* piste de fond */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        {/* anneau de progression -- se vide au fil du cycle 5min */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
        />
        <text x={cx} y={cy - 18} textAnchor="middle" className="fill-zinc-100" style={{ fontSize: 13, fontWeight: 600 }}>
          {label}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-zinc-100 tabular-nums" style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {pad2(Math.floor(secondsLeft / 60))}:{pad2(Math.floor(secondsLeft % 60))}
        </text>
        <text x={cx} y={cy + 34} textAnchor="middle" style={{ fontSize: 11, fill: leaning === "Up" ? "#34d399" : "#f87171" }}>
          {leaning === "Up" ? "▲" : "▼"} {deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(3)}%
        </text>
      </svg>
      <div className="text-[10.5px] text-zinc-600">
        strike {strike.toFixed(2)} · live {price.toFixed(2)}
      </div>
      <div className="text-[10px] text-zinc-700">ecoule {pad2(Math.floor((300 - secondsLeft) / 60))}:{pad2(Math.floor((300 - secondsLeft) % 60))} sur 5:00</div>
    </div>
  );
}

function AnimatedNumber({ value, decimals = 3 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    const start = performance.now();
    const duration = 600;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

// Horloge plein ecran (Steven 04/08, "AUCUNE modestie n'est permise, on veut
// le MAX") : synchronisee sur l'horloge serveur (/api/clock, meme source que
// PrevisionsTab), un cadran radial par symbole avec strike/prix live/tendance,
// et le solde du portefeuille en gros au centre avec animation de transition
// a chaque changement. Bouton plein ecran natif (Fullscreen API) -- concu
// pour rester affiche en continu sur un second ecran, "comme une montre".
export function WatchTab({ cashUsdc, totalPnl }: { cashUsdc: number; totalPnl: number }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSecondsLeftBySym, setLocalSecondsLeftBySym] = useState<Record<string, { secs: number; ts: number }>>({});
  const [, forceTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/admin/mmtrade/clock", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d?.error) {
            setError(d.error);
            return;
          }
          setError(null);
          setData(d);
          const now = Date.now();
          const next: Record<string, { secs: number; ts: number }> = {};
          for (const [sym, info] of Object.entries<any>(d.per_symbol ?? {})) {
            if (info && typeof info.seconds_left === "number") next[sym] = { secs: info.seconds_left, ts: now };
          }
          setLocalSecondsLeftBySym(next);
        })
        .catch((e) => !cancelled && setError(String(e)));
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen().catch(() => {});
  }

  const perSymbol: Record<string, any> = data?.per_symbol ?? {};
  const symbols = Object.keys(perSymbol);

  return (
    <div ref={containerRef} className={isFullscreen ? "flex min-h-screen w-full flex-col justify-center bg-[#08080b] p-10" : ""}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] text-zinc-500">
          Synchronise sur l&apos;horloge serveur -- decalage {data?.clock_offset_ms ?? 0}ms · {data?.cycles_analyzed ?? 0} cycles
          analyses.
        </div>
        <button
          onClick={toggleFullscreen}
          className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20"
        >
          {isFullscreen ? "Quitter le plein ecran" : "Plein ecran"}
        </button>
      </div>

      {error && (
        <Card className="mb-3 border-red-500/20 bg-red-500/[0.06]">
          <div className="text-xs text-red-300">{error}</div>
        </Card>
      )}

      <Card className={isFullscreen ? "border-none bg-transparent p-0 shadow-none" : ""}>
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Portefeuille</div>
            <div className="mt-1 font-mono text-5xl font-bold tabular-nums text-zinc-50 sm:text-6xl">
              <AnimatedNumber value={cashUsdc} decimals={2} />
              <span className="text-2xl text-zinc-500">$</span>
            </div>
            <div className={`mt-1 text-sm font-medium tabular-nums ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}
              <AnimatedNumber value={totalPnl} decimals={3} />$ PnL reel (interne)
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8">
            {symbols.length === 0 && <div className="text-xs text-zinc-500">Aucun cycle actif pour l&apos;instant.</div>}
            {symbols.map((sym) => {
              const info = perSymbol[sym];
              if (!info) return null;
              const ref = localSecondsLeftBySym[sym];
              const liveSecs = ref ? Math.max(0, ref.secs - (Date.now() - ref.ts) / 1000) : info.seconds_left;
              return (
                <WatchDial
                  key={sym}
                  label={sym}
                  secondsLeft={liveSecs}
                  strike={Number(info.strike ?? 0)}
                  price={Number(info.price ?? 0)}
                  size={isFullscreen ? 260 : 200}
                />
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
