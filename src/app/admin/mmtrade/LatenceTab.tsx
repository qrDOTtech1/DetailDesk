"use client";
import { useEffect, useState } from "react";
import { Sparkline } from "./Sparkline";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function StageCard({ label, s }: { label: string; s: any }) {
  if (!s || s.count === 0) {
    return (
      <Card>
        <div className="text-xs font-medium text-zinc-300">{label}</div>
        <div className="mt-2 text-[11px] text-zinc-600">pas encore de mesure</div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="text-xs font-medium text-zinc-300">{label}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-lg font-semibold tabular-nums text-zinc-100">{s.p50}</div><div className="text-[10px] text-zinc-500">p50 ms</div></div>
        <div><div className="text-lg font-semibold tabular-nums text-amber-400">{s.p95}</div><div className="text-[10px] text-zinc-500">p95 ms</div></div>
        <div><div className="text-lg font-semibold tabular-nums text-red-400">{s.p99}</div><div className="text-[10px] text-zinc-500">p99 ms</div></div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
        <span>min {s.min}ms</span>
        <span>max {s.max}ms</span>
        <span>{s.count} mesures</span>
      </div>
    </Card>
  );
}

// Historique de latence (Steven 04/08, "onglet dedie calcul latence
// historique, on a besoin de ces donnees pour s'ameliorer") : p95/p99 mis en
// avant volontairement, pas juste la mediane -- ce sont les pics rares qui
// coutent le plus cher sur un marche qui bouge en quelques secondes, une
// mediane flatteuse peut cacher un p99 catastrophique.
export function LatenceTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eq, setEq] = useState<any>(null);

  useEffect(() => {
    fetch("/admin/mmtrade/latency")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
    fetch("/admin/mmtrade/execution-quality")
      .then((r) => r.json())
      .then(setEq)
      .catch(() => {});
  }, []);

  if (loading) return <Card><div className="text-xs text-zinc-500">Chargement...</div></Card>;
  if (data?.error) return <Card className="border-red-500/20 bg-red-500/[0.06]"><div className="text-xs text-red-300">{data.error}</div></Card>;

  const stats = data?.stats ?? {};
  const history: any[] = data?.history ?? [];
  const totalPoints = history.map((h) => ({ ts: h.ts, price: h.total_ms }));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500">
        Chaque post d&apos;ordre reel decompose en 4 etapes. Se base sur les {history.length} dernieres mesures
        (accumule depuis le redemarrage du bot -- vide apres un redeploiement).
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StageCard label="TOTAL (detection -> ordre poste)" s={stats.total_ms} />
        <StageCard label="Avant post (checks/preflight)" s={stats.avant_post_ms} />
        <StageCard label="Baseline (lecture solde on-chain)" s={stats.baseline_ms} />
        <StageCard label="Signature (2 ordres, en parallele)" s={stats.signature_ms} />
        <StageCard label="Soumission reseau (post_orders)" s={stats.post_orders_ms} />
      </div>

      {eq?.stats && eq.stats.attempted > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">Qualite d&apos;execution</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <div className="text-[11px] text-zinc-500">Fill ratio</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{eq.stats.fill_ratio_pct}%</div>
              <div className="mt-1 text-[10px] text-zinc-600">{eq.stats.filled}/{eq.stats.attempted} paires</div>
            </Card>
            <Card>
              <div className="text-[11px] text-zinc-500">EV net de fees (moy.)</div>
              <div className={`mt-1 text-xl font-semibold tabular-nums ${(eq.stats.avg_ev_net_fees_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {eq.stats.avg_ev_net_fees_pct}%
              </div>
            </Card>
            <Card>
              <div className="text-[11px] text-zinc-500">Fraicheur donnees (moy.)</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{eq.stats.avg_feed_age_ms}ms</div>
            </Card>
            <Card>
              <div className="text-[11px] text-zinc-500">Fraicheur donnees (max)</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-amber-400">{eq.stats.max_feed_age_ms}ms</div>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <div className="mb-1 text-sm font-medium">Latence totale dans le temps</div>
        {totalPoints.length === 0 ? (
          <div className="text-xs text-zinc-500">Pas encore de mesure -- attend le prochain arb tente.</div>
        ) : (
          <Sparkline symbol="TOTAL (ms)" points={totalPoints} />
        )}
      </Card>

      {history.length > 0 && (
        <Card>
          <div className="mb-2 text-sm font-medium">Dernieres mesures</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-500">
                <tr><th className="pb-1 pr-3">Symbole</th><th className="pb-1 pr-3">Baseline</th><th className="pb-1 pr-3">Signature</th><th className="pb-1 pr-3">Soumission</th><th className="pb-1">Total</th></tr>
              </thead>
              <tbody className="text-zinc-300">
                {history.slice(-20).reverse().map((h: any, i: number) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1 pr-3 font-medium">{h.symbol}</td>
                    <td className="py-1 pr-3 tabular-nums">{h.baseline_ms ?? "-"}ms</td>
                    <td className="py-1 pr-3 tabular-nums">{h.signature_ms ?? "-"}ms</td>
                    <td className="py-1 pr-3 tabular-nums">{h.post_orders_ms ?? "-"}ms</td>
                    <td className="py-1 tabular-nums font-medium">{h.total_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
