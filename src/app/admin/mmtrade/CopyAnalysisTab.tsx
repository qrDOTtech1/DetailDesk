"use client";
import { useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: "up" | "down"; hint?: string }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-100";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] leading-tight text-zinc-600">{hint}</div>}
    </div>
  );
}

type Band = {
  band: string;
  n: number;
  win_rate_pct: number;
  cost: number;
  roi_pct: number | null;
  solo_pct: number;
};

// Analyse copy-trading (Steven 05/08, "inclu une fenetre dediee a l'analyse
// copy dans dash"). Polymarket n'expose aucune API de leaderboard publique --
// Steven trouve un wallet interessant via l'UI Polymarket (leaderboard,
// profil d'un trader) et le colle ici. L'outil reconstruit son activite
// on-chain et sort exactement les metriques qui ont servi a diagnostiquer le
// bot cette nuit : win rate par tranche de prix, ROI, taux d'usage de l'arb,
// et la bande 0.95-0.98 isolee (seule strategie directionnelle validee).
export function CopyAnalysisTab() {
  const [wallet, setWallet] = useState("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function analyze() {
    const w = wallet.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(w)) {
      setError("Adresse invalide (attendu 0x + 40 caracteres hexadecimaux)");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/admin/mmtrade/copy-analysis?wallet=${w}&max_pages=10`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error);
          setData(null);
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  const bands: Band[] = data?.bands ?? [];
  const nc = data?.near_cert_0_95_0_98;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-sky-300">
        Pas de leaderboard public cote Polymarket -- trouve un wallet interessant via leur UI (profil d&apos;un trader,
        colonne &quot;copy&quot;) et colle son adresse ici. Lecture seule, aucun ordre n&apos;est jamais passe.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyze()}
          placeholder="0x..."
          className="min-w-[280px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
        />
        <button
          onClick={analyze}
          disabled={loading}
          className="rounded-full bg-sky-500/15 px-4 py-2 text-[11px] font-medium text-sky-300 ring-1 ring-sky-500/30 transition hover:bg-sky-500/25 disabled:opacity-50"
        >
          {loading ? "Analyse..." : "Analyser"}
        </button>
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/[0.06]">
          <div className="text-xs text-red-300">{error}</div>
        </Card>
      )}

      {data && data.ok && (
        <>
          {data.events_updown_5m === 0 ? (
            <Card>
              <div className="text-xs text-zinc-500">{data.message}</div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile
                  label="ROI global"
                  value={data.overall_roi_pct !== null ? `${data.overall_roi_pct >= 0 ? "+" : ""}${data.overall_roi_pct}%` : "-"}
                  tone={data.overall_roi_pct >= 0 ? "up" : "down"}
                  hint={`${data.total_cost_usd}$ engages sur ${data.days_active}j`}
                />
                <StatTile
                  label="Usage de l'arb"
                  value={data.arb_usage_pct !== null ? `${data.arb_usage_pct}%` : "-"}
                  tone={data.arb_usage_pct >= 50 ? "up" : "down"}
                  hint="jambes en paire vs jambes seules"
                />
                <StatTile
                  label="Marches Up/Down 5min"
                  value={data.events_updown_5m}
                  hint={`sur ${data.events_total} evenements totaux`}
                />
                <StatTile
                  label="Bande 0.95-0.98"
                  value={nc ? `${nc.roi_pct >= 0 ? "+" : ""}${nc.roi_pct}%` : "n/a"}
                  tone={nc ? (nc.roi_pct >= 0 ? "up" : "down") : undefined}
                  hint={nc ? `${nc.n} trades, WR ${nc.win_rate_pct}%` : "pas assez de donnees"}
                />
              </div>

              {bands.length > 0 && (
                <Card className="overflow-x-auto">
                  <div className="mb-2 text-xs font-medium text-zinc-300">Win rate et ROI par tranche de prix d&apos;achat</div>
                  <table className="w-full min-w-[520px] text-left text-[11.5px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-zinc-500">
                        <th className="pb-2 pr-3 font-medium">Prix</th>
                        <th className="pb-2 pr-3 font-medium">n</th>
                        <th className="pb-2 pr-3 font-medium">Win rate</th>
                        <th className="pb-2 pr-3 font-medium">Engage</th>
                        <th className="pb-2 pr-3 font-medium">ROI</th>
                        <th className="pb-2 font-medium">% jambe seule</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      {bands.map((b) => (
                        <tr key={b.band} className="border-t border-white/5">
                          <td className="py-1.5 pr-3 font-medium text-zinc-200">{b.band}</td>
                          <td className="py-1.5 pr-3 tabular-nums text-zinc-400">{b.n}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{b.win_rate_pct}%</td>
                          <td className="py-1.5 pr-3 tabular-nums text-zinc-400">{b.cost}$</td>
                          <td className={`py-1.5 pr-3 tabular-nums font-semibold ${(b.roi_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {b.roi_pct !== null ? `${b.roi_pct >= 0 ? "+" : ""}${b.roi_pct}%` : "-"}
                          </td>
                          <td className="py-1.5 tabular-nums text-zinc-500">{b.solo_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
