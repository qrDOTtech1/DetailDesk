"use client";
import { useEffect, useState } from "react";
import { Card, StatTile, Bar, fmtTime } from "./ArbQualityTab";

// MSF -- "Maker Sur Fenetre" (nom donne par Steven le 07/08). Deux ordres
// limites passifs poses des l'ouverture d'une fenetre 5min Up/Down au meme
// prix fixe : si les deux se remplissent, l'arb est verrouille a zero frais
// (maker cote Polymarket). Si une seule jambe se remplit, deux issues :
// attendre le cutoff (perte si le marche part dans le mauvais sens), ou
// prendre profit plus tot des que le prix depasse un seuil (le "TP").
//
// Ce switch coupe UNIQUEMENT le TP -- pas MSF lui-meme. OFF : la jambe
// seule retombe au comportement d'avant le TP (attente jusqu'au cutoff),
// sans jamais lire le carnet ni tenter de vendre en cours de route.

type MsfEntry = {
  ts: number;
  symbol: string;
  slug: string;
  issue: "les_deux" | "une_seule" | "tp" | "aucun" | "refuse" | string;
  combine?: number | null;
  parts?: number | null;
  prix?: number | null;
  vendu?: number | null;
  sortie?: number | null;
  net?: number;
};

const ISSUE_META: Record<string, { label: string; sub: string; cls: string }> = {
  les_deux: {
    label: "Verrouille",
    sub: "les 2 jambes remplies, zero frais",
    cls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  },
  tp: {
    label: "TP",
    sub: "jambe seule vendue en profit avant le cutoff",
    cls: "text-sky-300 bg-sky-500/10 ring-sky-500/20",
  },
  une_seule: {
    label: "Une seule jambe",
    sub: "soldee au cutoff, sans TP",
    cls: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  },
  aucun: { label: "Non rempli", sub: "annule -- cout zero", cls: "text-zinc-400 bg-white/5 ring-white/10" },
  refuse: { label: "Refuse", sub: "ordre rejete -- cout zero", cls: "text-zinc-400 bg-white/5 ring-white/10" },
};

function Toggle({
  on,
  busy,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      disabled={busy}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? "bg-emerald-500/70" : "bg-white/10"
      }`}
      style={{ width: 52 }}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-[28px]" : "translate-x-[4px]"
        }`}
      />
    </button>
  );
}

export function MSFTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [optimisticOn, setOptimisticOn] = useState<boolean | null>(null);

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

  const mo = data?.preopen?.maker_open;
  const tpOn = optimisticOn ?? mo?.msf_tp_enabled ?? true;

  async function toggleTp(next: boolean) {
    setOptimisticOn(next);
    setToggleBusy(true);
    try {
      await fetch("/admin/mmtrade/msf-tp-toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      load();
    } catch {
      setOptimisticOn(null); // echec -- on revient a la valeur serveur au prochain refresh
    } finally {
      setToggleBusy(false);
    }
  }

  const recent: MsfEntry[] = mo?.recent ?? [];
  const netTotal = mo?.net_total ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">MSF -- Maker Sur Fenetre</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Deux ordres limites passifs poses aux deux bords d&apos;une fenetre 5min : verrouilles
          ensemble, l&apos;arb ne coute aucun frais. Le TP ci-dessous ne concerne que les jambes
          seules -- il ne desactive jamais MSF lui-meme.
        </p>
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
      ) : !mo ? (
        <Card>
          <div className="text-xs text-zinc-500">Aucune donnee MSF pour l&apos;instant.</div>
        </Card>
      ) : (
        <>
          {/* Hero : PnL net cumule, en grand. */}
          <Card
            className={`bg-gradient-to-br to-transparent ${
              netTotal >= 0 ? "border-emerald-500/20 from-emerald-500/[0.08]" : "border-red-500/20 from-red-500/[0.08]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  className={`text-[10.5px] uppercase tracking-wide ${
                    netTotal >= 0 ? "text-emerald-300/70" : "text-red-300/70"
                  }`}
                >
                  PnL net cumule (MSF, tout l&apos;historique)
                </div>
                <div
                  className={`mt-1 text-4xl font-semibold tabular-nums ${
                    netTotal >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {netTotal >= 0 ? "+" : ""}
                  {netTotal.toFixed(2)} $
                </div>
                <div className="mt-1.5 max-w-md text-[11px] leading-relaxed text-zinc-400">
                  Verrouille : {(mo.net_locked ?? 0) >= 0 ? "+" : ""}
                  {(mo.net_locked ?? 0).toFixed(2)}$ · TP : {(mo.net_tp ?? 0) >= 0 ? "+" : ""}
                  {(mo.net_tp ?? 0).toFixed(2)}$ · Jambe seule (sans TP) :{" "}
                  {(mo.net_solo ?? 0) >= 0 ? "+" : ""}
                  {(mo.net_solo ?? 0).toFixed(2)}$
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Etat</div>
                <div className={`mt-1 text-sm font-semibold ${mo.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
                  {mo.enabled ? "actif" : "inactif"}
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-600">{(mo.symbols ?? []).join(", ") || "-"}</div>
              </div>
            </div>
          </Card>

          {/* Interrupteur TP */}
          <Card className={tpOn ? "" : "border-amber-500/25 bg-amber-500/[0.04]"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-zinc-200">Take-profit sur jambe seule</div>
                <div className="mt-0.5 max-w-lg text-[11px] leading-relaxed text-zinc-500">
                  {tpOn
                    ? `Actif : des ${mo.tp_min_hold_s ?? 15}s de detention, si le meilleur bid atteint ${(
                        mo.tp_mult ?? 1.8
                      ).toFixed(2)}x le prix d'entree (${(mo.prix ?? 0.35).toFixed(2)}$), la jambe seule est vendue en profit au lieu d'attendre le cutoff.`
                    : "Desactive : une jambe seule attend desormais le cutoff habituel comme avant l'existence du TP -- aucune lecture de carnet, aucune vente anticipee."}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`text-[11px] font-medium ${tpOn ? "text-emerald-400" : "text-zinc-500"}`}>
                  {tpOn ? "ON" : "OFF"}
                </span>
                <Toggle on={tpOn} busy={toggleBusy} onChange={toggleTp} />
              </div>
            </div>
          </Card>

          {/* Reglages actuels */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Prix d'entree" value={`${(mo.prix ?? 0).toFixed(2)}$`} hint="pose sur les 2 cotes" />
            <StatTile label="Seuil TP" value={`x${(mo.tp_mult ?? 0).toFixed(2)}`} hint="multiplicateur du prix d'entree" />
            <StatTile label="Detention min." value={`${mo.tp_min_hold_s ?? 0}s`} hint="avant que le TP puisse s'activer" />
            <StatTile
              label="Taux de verrouillage"
              value={mo.fill_rate_pct != null ? `${mo.fill_rate_pct}%` : "-"}
              tone={mo.fill_rate_pct >= 50 ? "up" : mo.fill_rate_pct >= 25 ? "warn" : mo.fill_rate_pct != null ? "down" : undefined}
              hint={`${mo.locked ?? 0}/${mo.attempts ?? 0} tentatives`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Tentatives" value={mo.attempts ?? 0} />
            <StatTile label="Verrouillees" value={mo.locked ?? 0} tone="up" />
            <StatTile
              label="TP declenches"
              value={mo.tp ?? 0}
              hint={`${mo.tp_reussis ?? 0} vendus / ${mo.tp_rates ?? 0} rates`}
              tone={(mo.tp_rates ?? 0) > 0 ? "warn" : undefined}
            />
            <StatTile label="Sans TP (cutoff)" value={mo.solo ?? 0} tone={(mo.solo ?? 0) > 0 ? "warn" : "up"} />
          </div>

          <Card>
            <div className="mb-3 text-xs font-medium text-zinc-300">Devenir des tentatives</div>
            <Bar
              parts={[
                { label: "Verrouillees", n: mo.locked ?? 0, className: "bg-emerald-500" },
                { label: "TP", n: mo.tp ?? 0, className: "bg-sky-500" },
                { label: "Sans TP (cutoff)", n: mo.solo ?? 0, className: "bg-amber-500" },
                { label: "Sans suite (gratuit)", n: mo.free_misses ?? 0, className: "bg-zinc-600" },
              ]}
            />
          </Card>

          {/* Releve */}
          <Card className="p-0">
            <div className="px-4 pb-2 pt-4 text-xs font-medium text-zinc-300">
              Releve MSF
              <span className="ml-2 font-normal text-zinc-600">le net $ tient compte du TP et du verrou</span>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-zinc-500">Aucune tentative enregistree pour l&apos;instant.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {recent.map((r, i) => {
                  const m = ISSUE_META[r.issue] ?? ISSUE_META.aucun;
                  const net = typeof r.net === "number" ? r.net : 0;
                  return (
                    <div key={`${r.slug}-${r.ts}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11.5px] font-medium text-zinc-200">{r.symbol}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${m.cls}`}>
                            {m.label}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-zinc-600">
                          {fmtTime(r.ts)} — {m.sub}
                          {r.combine != null && ` — combine ${r.combine.toFixed(3)}`}
                          {r.issue === "tp" && r.prix != null && r.sortie != null && (
                            <>
                              {" "}
                              — {r.prix.toFixed(2)} → {r.sortie.toFixed(2)}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`text-[12.5px] font-semibold tabular-nums ${
                            net > 0.001 ? "text-emerald-400" : net < -0.001 ? "text-red-400" : "text-zinc-600"
                          }`}
                        >
                          {net > 0.001 ? "+" : ""}
                          {net.toFixed(2)} $
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
