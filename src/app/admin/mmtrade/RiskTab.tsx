"use client";
import { useEffect, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1.5 text-[12px] last:border-b-0">
      <span className="text-zinc-500">{label}</span>
      <span className="tabular-nums font-medium text-zinc-200">{value}</span>
    </div>
  );
}

// Onglet Risque -- SL/TP (Steven 04/08, "AUCUNE SL TP ????") : ces reglages
// tournent cote bot depuis longtemps mais n'etaient visibles dans AUCUN
// dashboard avant ce soir. Lecture seule -- ce sont des constantes de code
// (real_web/trader.py), pas un etat modifiable a chaud comme le floor ou le
// kill-switch ; toute modification doit passer par un deploiement.
export function RiskTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/admin/mmtrade/risk-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d?.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <Card className="border-red-500/20 bg-red-500/[0.06]">
        <div className="text-xs text-red-300">{error}</div>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <div className="text-xs text-zinc-500">Chargement...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300">
        Ces valeurs sont des constantes de code (real_web/trader.py) -- lecture seule ici, tout changement nécessite
        un déploiement, pas un simple clic dashboard.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Take-profit par palier (positions directionnelles)</div>
          <Row label="Palier 1" value={`+${(data.tp.cibles_pnl_pct[0] * 100).toFixed(0)}% -> vend ${(data.tp.fractions_par_palier[0] * 100).toFixed(0)}%`} />
          <Row label="Palier 2" value={`+${(data.tp.cibles_pnl_pct[1] * 100).toFixed(0)}% -> vend ${(data.tp.fractions_par_palier[1] * 100).toFixed(0)}%`} />
          <Row label="Palier 3" value={`+${(data.tp.cibles_pnl_pct[2] * 100).toFixed(0)}% -> vend ${(data.tp.fractions_par_palier[2] * 100).toFixed(0)}%`} />
          <Row label="Runner (trailing)" value={`${(data.tp.fractions_par_palier[3] * 100).toFixed(0)}% restant`} />
          <div className="mt-2 text-[10.5px] text-zinc-600">
            Le trailing s&apos;arme des +{(data.tp.trailing_activation_pct * 100).toFixed(0)}% et vend le runner s&apos;il redonne{" "}
            {(data.tp.trailing_giveback_pct * 100).toFixed(0)}% depuis son pic.
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Stop-loss principal</div>
          <Row label="Seuil" value={`-${(data.sl.seuil_pct * 100).toFixed(0)}% de PnL`} />
          <Row label="Desactive si moins de" value={`${data.sl.secs_left_min}s restantes`} />
          <Row label="Frequence de verification" value={`${data.sl.poll_intervalle_s}s (thread dedie)`} />
          <div className="mt-2 text-[10.5px] text-zinc-600">
            Resserre depuis -30% (retour d&apos;experience : le prix crashe plus vite que la verification periodique
            ne l&apos;attrapait, la perte moyenne depassait largement le seuil nominal).
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Stop-loss contextuel par symbole</div>
          {Object.entries<number>(data.sl.multiplicateur_contextuel_par_symbole ?? {}).map(([sym, mult]) => (
            <Row key={sym} label={sym} value={`x${mult.toFixed(2)}`} />
          ))}
          <div className="mt-2 text-[10.5px] text-zinc-600">
            Un symbole plus volatile (DOGE, XRP) a un stop plus large que BTC/ETH -- evite de couper une position sur
            du bruit normal.
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Sortie orphelins (jambe seule)</div>
          <Row label="Prix declencheur TP" value={data.orphan.tp_price} />
          <Row label="Profit minimum requis" value={`+${data.orphan.tp_min_profit}`} />
          <Row label="Fraction vendue au TP" value={`${(data.orphan.tp_sell_fraction * 100).toFixed(0)}%`} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Stop-loss arbitrage</div>
          <Row label="S'active a" value={`${data.arb_sl.secs_left_activation}s avant resolution`} />
          <Row label="Seuil bid (jambe morte)" value={`< ${data.arb_sl.bid_threshold}`} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Stop-loss both-side</div>
          <Row label="Prix seuil" value={data.both_side_sl.prix_seuil} />
          <Row label="Actif si plus de" value={`${data.both_side_sl.secs_left_min}s restantes`} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Sizing hedge (favori/underdog)</div>
          <Row label="Mise underdog (fixe)" value={`${data.sizing_hedge.underdog_bet_usd}$`} />
          <Row label="Couverture underdog visee" value={`x${data.sizing_hedge.underdog_coverage_mult}`} />
          <Row label="Mise favori (Kelly, plafond)" value={`${data.sizing_hedge.favorite_bet_max_usd}$`} />
          <Row label="Gain net vise (favori gagne)" value={`+${data.sizing_hedge.favorite_target_net_usd}$`} />
          <Row label="Prix favori max accepte" value={data.sizing_hedge.favorite_max_price} />
          <Row label="Probabilite calibree min." value={`${(data.sizing_hedge.min_calibrated_prob * 100).toFixed(0)}%`} />
          <div className="mt-2 text-[10.5px] text-zinc-600">
            La mise sur le favori est TOUJOURS bien plus grosse (Kelly, jusqu&apos;au plafond) que sur l&apos;underdog
            (montant fixe minuscule, simple assurance) -- jamais l&apos;inverse.
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Kelly fractionne</div>
          <Row label="Fraction appliquee" value={`${(data.kelly.fraction * 100).toFixed(0)}% de f*`} />
          <Row label="Edge suppose (repli)" value={`${(data.kelly.assumed_edge_fallback * 100).toFixed(0)}%`} />
          <div className="mt-2 text-[10.5px] text-zinc-600">
            Le repli ne sert que si la volatilite mesuree via Binance WS n&apos;est pas encore disponible (demarrage a
            froid) -- sinon l&apos;edge reel calcule est utilise.
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Sizing via signal Binance WS</div>
          <Row label="Momentum confirme" value={`x${data.binance_ws_sizing.momentum_boost_mult}`} />
          <Row label="Danger de retournement" value={`x${data.binance_ws_sizing.danger_reduce_mult}`} />
        </Card>

        <Card>
          <div className="mb-2 text-xs font-medium text-zinc-300">Gestionnaire de sortie RL</div>
          <Row label="Actif" value={data.rl_exit.enabled ? "oui" : "non"} />
          <Row label="Mode" value={data.rl_exit.shadow_mode ? "observation seule (shadow)" : "execution reelle"} />
          <Row label="Intervalle propositions" value={`${data.rl_exit.interval_s}s`} />
          <Row label="Desactive si moins de" value={`${data.rl_exit.min_secs_left}s restantes`} />
        </Card>
      </div>
    </div>
  );
}
