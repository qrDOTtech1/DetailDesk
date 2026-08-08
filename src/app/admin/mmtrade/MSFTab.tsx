"use client";
import { useEffect, useRef, useState } from "react";
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
//
// HABILLAGE "CASINO" (Steven 08/08, "ultra complet style casino, dynamique
// et anime") : purement cosmetique -- aucune de ces animations ne touche
// aux donnees ni aux decisions de trading, juste a la maniere de les
// presenter (or/emeraude, pulsations, chiffres qui comptent, nouvelles
// lignes qui "se distribuent" comme des cartes).

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

const ISSUE_META: Record<string, { label: string; sub: string; cls: string; icon: string }> = {
  les_deux: {
    label: "Verrouille",
    sub: "les 2 jambes remplies, zero frais",
    cls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
    icon: "🔒",
  },
  tp: {
    label: "TP",
    sub: "jambe seule vendue en profit avant le cutoff",
    cls: "text-sky-300 bg-sky-500/10 ring-sky-500/20",
    icon: "💰",
  },
  une_seule: {
    label: "Une seule jambe",
    sub: "soldee au cutoff, sans TP",
    cls: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
    icon: "⏳",
  },
  aucun: { label: "Non rempli", sub: "annule -- cout zero", cls: "text-zinc-400 bg-white/5 ring-white/10", icon: "·" },
  refuse: { label: "Refuse", sub: "ordre rejete -- cout zero", cls: "text-zinc-400 bg-white/5 ring-white/10", icon: "·" },
};

/** Fait defiler une valeur numerique vers sa nouvelle cible (effet "compteur
 * de jackpot" qui tourne), plutot qu'un saut sec au prochain rafraichissement. */
function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (Math.abs(to - from) < 0.001) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (to - from) * ease(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return display;
}

/** Ligne fine (2px, bouts arrondis) -- respecte les specs de trace du kit
 * dataviz : un seul trait, pas d'axes, pas de grille, juste la tendance. */
function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return <div className="h-7" />;
  const w = 100;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "#34d399" : "#f87171";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Jauge en demi-cercle (façon compteur de roulette) pour le taux de
 * reussite recent -- un seul arc, couleur de statut, jamais color-alone
 * (le pourcentage est toujours ecrit a cote). */
function Gauge({ pct }: { pct: number | null }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - p / 100);
  const color = p >= 60 ? "#34d399" : p >= 40 ? "#fbbf24" : "#f87171";
  return (
    <svg viewBox="0 0 100 54" className="w-full">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
      />
    </svg>
  );
}

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
        on ? "bg-emerald-500/70 animate-msf-glow-pulse" : "bg-white/10"
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

function computeStreak(recent: MsfEntry[]) {
  let streak = 0;
  let kind: "win" | "loss" | null = null;
  for (const r of recent) {
    const net = typeof r.net === "number" ? r.net : 0;
    const isWin = r.issue === "les_deux" || (r.issue === "tp" && net > 0.001);
    const isLoss = net < -0.001;
    if (streak === 0) {
      if (isWin) {
        kind = "win";
        streak = 1;
      } else if (isLoss) {
        kind = "loss";
        streak = 1;
      } else {
        break;
      }
    } else if (kind === "win" && isWin) streak++;
    else if (kind === "loss" && isLoss) streak++;
    else break;
  }
  return { streak, kind };
}

export function MSFTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [optimisticOn, setOptimisticOn] = useState<boolean | null>(null);
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

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
  const recent: MsfEntry[] = mo?.recent ?? [];

  // DETECTION DES NOUVELLES LIGNES (Steven 08/08) : meme pattern que l'alerte
  // sonore de l'onglet Qualite des arbs -- au 1er chargement on memorise tout
  // sans rien animer, seules les entrees qui arrivent APRES declenchent la
  // "distribution de carte" + le flash gain/perte.
  useEffect(() => {
    if (!recent.length) return;
    const keyOf = (r: MsfEntry) => `${r.slug}-${r.ts}`;
    if (!initializedRef.current) {
      recent.forEach((r) => seenRef.current.add(keyOf(r)));
      initializedRef.current = true;
      return;
    }
    const nouveaux = new Set<string>();
    recent.forEach((r) => {
      const k = keyOf(r);
      if (!seenRef.current.has(k)) {
        seenRef.current.add(k);
        nouveaux.add(k);
      }
    });
    if (nouveaux.size) {
      setFreshKeys(nouveaux);
      const t = setTimeout(() => setFreshKeys(new Set()), 1600);
      return () => clearTimeout(t);
    }
  }, [recent]);

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

  const netTotal = mo?.net_total ?? 0;
  const netTotalDisplay = useAnimatedNumber(netTotal);

  // SERIE EN COURS ("streak"), meilleur/pire coup, jauge de reussite et
  // sparkline -- tout calcule cote client depuis le releve deja recu, aucun
  // appel supplementaire.
  const { streak, kind: streakKind } = computeStreak(recent);
  const withNet = recent.filter((r) => typeof r.net === "number") as (MsfEntry & { net: number })[];
  const best = withNet.length ? withNet.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worst = withNet.length ? withNet.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const decided = recent.filter((r) => r.issue === "les_deux" || r.issue === "tp" || r.issue === "une_seule");
  const winsRecent = decided.filter((r) => (typeof r.net === "number" ? r.net > 0.001 : r.issue === "les_deux"));
  const winRatePct = decided.length ? Math.round((100 * winsRecent.length) / decided.length) : null;
  const chrono = [...recent].reverse();
  let _cum = 0;
  const cumSeries = chrono.map((r) => (_cum += typeof r.net === "number" ? r.net : 0));

  return (
    <div
      className="relative space-y-4 rounded-2xl p-3 sm:p-4"
      style={{
        background:
          "radial-gradient(120% 100% at 15% -10%, rgba(16,185,129,0.07), transparent 55%), " +
          "radial-gradient(90% 90% at 100% 0%, rgba(251,191,36,0.06), transparent 55%), " +
          "radial-gradient(140% 100% at 50% 120%, rgba(16,185,129,0.05), transparent 60%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <span aria-hidden>🎰</span> MSF -- Maker Sur Fenetre
          </h2>
          <p className="mt-0.5 max-w-xl text-[11px] text-zinc-500">
            Deux ordres limites passifs poses aux deux bords d&apos;une fenetre 5min : verrouilles
            ensemble, l&apos;arb ne coute aucun frais. Le TP ci-dessous ne concerne que les jambes
            seules -- il ne desactive jamais MSF lui-meme.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 ring-1 ring-white/10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-msf-dot-pulse rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/80">En direct</span>
        </div>
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
          {/* Hero "jackpot" : PnL net cumule, chiffre qui defile, contour or qui respire. */}
          <div
            className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ${
              netTotal >= 0
                ? "border-amber-400/30 bg-gradient-to-br from-emerald-500/[0.10] via-transparent to-amber-500/[0.06]"
                : "border-red-500/25 bg-gradient-to-br from-red-500/[0.10] to-transparent"
            }`}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, transparent 30%, rgba(251,191,36,0.16) 45%, rgba(251,191,36,0.32) 50%, rgba(251,191,36,0.16) 55%, transparent 70%)",
                backgroundSize: "200% 100%",
              }}
            >
              <div className="h-full w-full animate-msf-shimmer" style={{ backgroundImage: "inherit", backgroundSize: "inherit" }} />
            </div>
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  className={`text-[10.5px] uppercase tracking-wide ${
                    netTotal >= 0 ? "text-amber-300/80" : "text-red-300/70"
                  }`}
                >
                  💰 PnL net cumule (MSF, tout l&apos;historique)
                </div>
                <div
                  className={`mt-1 text-5xl font-bold tabular-nums drop-shadow-[0_0_18px_rgba(251,191,36,0.25)] ${
                    netTotal >= 0 ? "text-emerald-300" : "text-red-400"
                  }`}
                >
                  {netTotalDisplay >= 0 ? "+" : ""}
                  {netTotalDisplay.toFixed(2)} $
                </div>
                <div className="mt-1.5 max-w-md text-[11px] leading-relaxed text-zinc-400">
                  Verrouille : {(mo.net_locked ?? 0) >= 0 ? "+" : ""}
                  {(mo.net_locked ?? 0).toFixed(2)}$ · TP : {(mo.net_tp ?? 0) >= 0 ? "+" : ""}
                  {(mo.net_tp ?? 0).toFixed(2)}$ · Jambe seule (sans TP) :{" "}
                  {(mo.net_solo ?? 0) >= 0 ? "+" : ""}
                  {(mo.net_solo ?? 0).toFixed(2)}$
                </div>
                {streak >= 2 && (
                  <div
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                      streakKind === "win"
                        ? "bg-amber-500/15 text-amber-300 ring-amber-500/30 animate-msf-glow-pulse"
                        : "bg-red-500/10 text-red-300 ring-red-500/20"
                    }`}
                  >
                    {streakKind === "win" ? "🔥" : "🥶"} {streak} {streakKind === "win" ? "gains" : "pertes"} d&apos;affilee
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Etat</div>
                <div className={`mt-1 text-sm font-semibold ${mo.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
                  {mo.enabled ? "actif" : "inactif"}
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-600">{(mo.symbols ?? []).join(", ") || "-"}</div>
                {cumSeries.length >= 2 && (
                  <div className="mt-2 w-28">
                    <Sparkline points={cumSeries} positive={cumSeries[cumSeries.length - 1] >= 0} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Jauge de reussite + meilleur/pire coup -- ambiance "table de jeu". */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Card className="flex flex-col items-center justify-center text-center">
              <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Taux de reussite (releve)</div>
              <Gauge pct={winRatePct} />
              <div className="-mt-3 text-2xl font-bold tabular-nums text-zinc-100">
                {winRatePct != null ? `${winRatePct}%` : "-"}
              </div>
              <div className="text-[10px] text-zinc-600">{winsRecent.length}/{decided.length} tentatives tranchees</div>
            </Card>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <div className="text-[10.5px] uppercase tracking-wide text-emerald-300/70">🏆 Meilleur coup</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">
                {best ? `+${best.net.toFixed(2)} $` : "-"}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-600">
                {best ? `${best.symbol} — ${fmtTime(best.ts)}` : "aucune donnee"}
              </div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
              <div className="text-[10.5px] uppercase tracking-wide text-red-300/70">💸 Pire coup</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-red-400">
                {worst ? `${worst.net.toFixed(2)} $` : "-"}
              </div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-600">
                {worst ? `${worst.symbol} — ${fmtTime(worst.ts)}` : "aucune donnee"}
              </div>
            </div>
          </div>

          {/* Interrupteur TP */}
          <Card className={tpOn ? "border-emerald-500/20" : "border-amber-500/25 bg-amber-500/[0.04]"}>
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
            <div className="transition hover:-translate-y-0.5">
              <StatTile label="Prix d'entree" value={`${(mo.prix ?? 0).toFixed(2)}$`} hint="pose sur les 2 cotes" />
            </div>
            <div className="transition hover:-translate-y-0.5">
              <StatTile label="Seuil TP" value={`x${(mo.tp_mult ?? 0).toFixed(2)}`} hint="multiplicateur du prix d'entree" />
            </div>
            <div className="transition hover:-translate-y-0.5">
              <StatTile label="Detention min." value={`${mo.tp_min_hold_s ?? 0}s`} hint="avant que le TP puisse s'activer" />
            </div>
            <div className="transition hover:-translate-y-0.5">
              <StatTile
                label="Taux de verrouillage"
                value={mo.fill_rate_pct != null ? `${mo.fill_rate_pct}%` : "-"}
                tone={mo.fill_rate_pct >= 50 ? "up" : mo.fill_rate_pct >= 25 ? "warn" : mo.fill_rate_pct != null ? "down" : undefined}
                hint={`${mo.locked ?? 0}/${mo.attempts ?? 0} tentatives`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="transition hover:-translate-y-0.5">
              <StatTile label="Tentatives" value={mo.attempts ?? 0} />
            </div>
            <div className="transition hover:-translate-y-0.5">
              <StatTile label="Verrouillees" value={mo.locked ?? 0} tone="up" />
            </div>
            <div className="transition hover:-translate-y-0.5">
              <StatTile
                label="TP declenches"
                value={mo.tp ?? 0}
                hint={`${mo.tp_reussis ?? 0} vendus / ${mo.tp_rates ?? 0} rates`}
                tone={(mo.tp_rates ?? 0) > 0 ? "warn" : undefined}
              />
            </div>
            <div className="transition hover:-translate-y-0.5">
              <StatTile label="Sans TP (cutoff)" value={mo.solo ?? 0} tone={(mo.solo ?? 0) > 0 ? "warn" : "up"} />
            </div>
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

          {/* Releve -- nouvelles lignes "distribuees" comme des cartes, flash
              or/rouge selon gain ou perte. */}
          <Card className="p-0">
            <div className="px-4 pb-2 pt-4 text-xs font-medium text-zinc-300">
              🃏 Releve MSF
              <span className="ml-2 font-normal text-zinc-600">le net $ tient compte du TP et du verrou</span>
            </div>
            {recent.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-zinc-500">Aucune tentative enregistree pour l&apos;instant.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {recent.map((r, i) => {
                  const m = ISSUE_META[r.issue] ?? ISSUE_META.aucun;
                  const net = typeof r.net === "number" ? r.net : 0;
                  const key = `${r.slug}-${r.ts}`;
                  const isFresh = freshKeys.has(key);
                  return (
                    <div
                      key={`${key}-${i}`}
                      className={`flex items-center gap-3 px-4 py-2.5 ${isFresh ? "animate-msf-deal-in" : ""} ${
                        isFresh && net > 0.001 ? "animate-msf-flash-win" : isFresh && net < -0.001 ? "animate-msf-flash-loss" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="text-sm leading-none">{m.icon}</span>
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
                          className={`text-[12.5px] font-semibold tabular-nums ${isFresh ? "animate-msf-pop" : ""} ${
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
