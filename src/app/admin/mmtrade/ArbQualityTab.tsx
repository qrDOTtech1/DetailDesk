"use client";
import { useEffect, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: "up" | "down" | "warn"; hint?: string }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "text-zinc-100";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] leading-tight text-zinc-600">{hint}</div>}
    </div>
  );
}

type Pair = {
  slug: string;
  symbol: string;
  opened_ts: number | null;
  combined_nominal: number;
  combined_effective: number;
  locked: boolean;
  lock_margin: number;
  imbalance: number | null;
  cost: number;
  worst_payout: number;
  tagged_risk_free: boolean;
};

function fmtTime(ts: number | null) {
  if (!ts) return "-";
  try {
    return new Date(ts * 1000).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

// Qualite des paires d'arb (Steven 05/08). Le PnL seul ne dit pas SI une paire
// etait un vrai arb : elle peut gagner par chance en etant non verrouillee, ou
// perdre en etant correcte. Ce qui compte : le payout du PIRE cas couvre-t-il
// le cout ? Sur un marche binaire le gagnant paie 1$ PAR PART, donc le pire cas
// vaut min(parts_up, parts_down) -- d'ou l'importance du desequilibre de parts.
export function ArbQualityTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyProblems, setOnlyProblems] = useState(false);

  function load() {
    setLoading(true);
    fetch("/admin/mmtrade/arb-quality", { cache: "no-store" })
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
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const s = data?.summary;
  const pairs: Pair[] = data?.pairs ?? [];
  const shown = onlyProblems ? pairs.filter((p) => !p.locked) : pairs;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-sky-300">
        Une paire n&apos;est un arb <strong>garanti</strong> que si le payout du pire cas depasse le cout total. Le gagnant
        paie 1$ <strong>par part</strong> : le pire cas vaut donc min(parts Up, parts Down). Un desequilibre de parts detruit
        le verrou meme quand les prix sont bons.
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/[0.06]">
          <div className="text-xs text-red-300">{error}</div>
        </Card>
      )}

      {loading && !data ? (
        <Card>
          <div className="text-xs text-zinc-500">Chargement...</div>
        </Card>
      ) : (
        <>
          {s && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile
                  label="Taux de verrouillage"
                  value={s.lock_rate_pct !== null ? `${s.lock_rate_pct}%` : "-"}
                  tone={s.lock_rate_pct >= 80 ? "up" : s.lock_rate_pct >= 50 ? "warn" : "down"}
                  hint={`${s.locked_pairs}/${s.total_pairs} paires`}
                />
                <StatTile
                  label="Marge garantie"
                  value={`${s.guaranteed_margin_total >= 0 ? "+" : ""}${s.guaranteed_margin_total}$`}
                  tone={s.guaranteed_margin_total > 0 ? "up" : undefined}
                  hint="cumul sur les paires verrouillees"
                />
                <StatTile
                  label="Desequilibre median"
                  value={s.median_imbalance ?? "-"}
                  tone={s.median_imbalance && s.median_imbalance > 1.2 ? "down" : "up"}
                  hint="1.00 = parts parfaitement egales"
                />
                <StatTile
                  label="Faux risk-free"
                  value={s.mislabeled_risk_free}
                  tone={s.mislabeled_risk_free > 0 ? "down" : "up"}
                  hint="doit rester a 0"
                />
              </div>

              <Card>
                <div className="mb-2 text-xs font-medium text-zinc-300">Cout par 1$ de payout garanti</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Nominal (prix seuls)</div>
                    <div className={`mt-1 text-2xl font-semibold tabular-nums ${(s.median_combined_nominal ?? 1) < 1 ? "text-emerald-400" : "text-red-400"}`}>
                      {s.median_combined_nominal ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Effectif (apres sizing)</div>
                    <div className={`mt-1 text-2xl font-semibold tabular-nums ${(s.median_combined_effective ?? 1) < 1 ? "text-emerald-400" : "text-red-400"}`}>
                      {s.median_combined_effective ?? "-"}
                    </div>
                  </div>
                </div>
                {s.median_combined_nominal != null && s.median_combined_effective != null && (
                  <div className="mt-2 text-[11px] text-zinc-500">
                    Ecart du au sizing :{" "}
                    <span className={s.median_combined_effective - s.median_combined_nominal > 0.02 ? "text-red-400" : "text-emerald-400"}>
                      {(s.median_combined_effective - s.median_combined_nominal >= 0 ? "+" : "") +
                        (s.median_combined_effective - s.median_combined_nominal).toFixed(3)}
                    </span>
                    {" — au-dessus de 1.00, chaque paire perd de l'argent par construction."}
                  </div>
                )}
              </Card>
            </>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyProblems((v) => !v)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                onlyProblems ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/30" : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/8"
              }`}
            >
              Non verrouillees seulement
            </button>
            <button onClick={load} className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">
              Rafraichir
            </button>
          </div>

          {shown.length === 0 ? (
            <Card>
              <div className="text-xs text-zinc-500">Aucune paire a afficher.</div>
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[11.5px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 pr-3 font-medium">Marche</th>
                    <th className="pb-2 pr-3 font-medium">Nominal</th>
                    <th className="pb-2 pr-3 font-medium">Effectif</th>
                    <th className="pb-2 pr-3 font-medium">Ecart parts</th>
                    <th className="pb-2 pr-3 font-medium">Cout / payout</th>
                    <th className="pb-2 font-medium">Etat</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {shown.map((p) => (
                    <tr key={p.slug} className="border-t border-white/5">
                      <td className="py-1.5 pr-3">
                        <div className="font-medium text-zinc-200">{p.symbol}</div>
                        <div className="text-[10px] text-zinc-600">{fmtTime(p.opened_ts)}</div>
                      </td>
                      <td className={`py-1.5 pr-3 tabular-nums ${p.combined_nominal < 1 ? "text-emerald-400" : "text-red-400"}`}>
                        {p.combined_nominal.toFixed(3)}
                      </td>
                      <td className={`py-1.5 pr-3 tabular-nums ${p.combined_effective < 1 ? "text-emerald-400" : "text-red-400"}`}>
                        {p.combined_effective.toFixed(3)}
                      </td>
                      <td className={`py-1.5 pr-3 tabular-nums ${p.imbalance && p.imbalance > 1.2 ? "text-red-400" : "text-zinc-400"}`}>
                        {p.imbalance ? `${p.imbalance.toFixed(2)}x` : "-"}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums text-zinc-400">
                        {p.cost.toFixed(2)}$ / {p.worst_payout.toFixed(2)}
                      </td>
                      <td className="py-1.5">
                        {p.locked ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                            verrouillee {p.lock_margin >= 0 ? "+" : ""}
                            {p.lock_margin.toFixed(2)}$
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10.5px] font-medium text-red-300 ring-1 ring-red-500/20">
                            non verrouillee {p.lock_margin.toFixed(2)}$
                          </span>
                        )}
                        {p.tagged_risk_free && !p.locked && (
                          <span className="ml-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-300 ring-1 ring-amber-500/20">
                            faux risk-free
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
