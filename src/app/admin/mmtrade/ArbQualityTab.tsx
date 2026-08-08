"use client";
import { useEffect, useRef, useState } from "react";

// NOTIFICATION SONORE GAIN/PERTE (Steven 07/08). Synthetisee via Web Audio,
// aucun fichier audio a charger. Un son ASCENDANT pour un gain, DESCENDANT
// pour une perte -- la direction se reconnait sans avoir a regarder l'ecran.
let _audioCtx: AudioContext | null = null;
function _ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!_audioCtx) _audioCtx = new Ctor();
  if (_audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
  return _audioCtx;
}
function playAlert(kind: "gain" | "perte") {
  const ctx = _ctx();
  if (!ctx) return;
  const notes = kind === "gain" ? [523.25, 659.25, 783.99] : [523.25, 415.3, 329.63]; // do-mi-sol / do-la b-mi
  const step = 0.11;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + i * step;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.16, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 0.95);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + step);
  });
}

// QUALITE DES ARBS (Steven 05-06/08).
//
// Le PnL seul ne dit pas SI une paire etait un vrai arb : elle peut gagner par
// chance en etant non verrouillee, ou perdre en etant correcte. Ce qui compte :
// le payout du PIRE cas couvre-t-il le cout ? Sur un marche binaire le gagnant
// paie 1$ PAR PART, donc le pire cas vaut min(parts Up, parts Down) -- d'ou
// l'importance du desequilibre de parts.
//
// La section PRE-OUVERTURE est separee pour une raison de fond : ses echecs
// sont invisibles dans le PnL. Polymarket ne regle que les trades executes
// (l'historique on-chain ne contient que des TRADE et des REDEEM, jamais
// d'ORDER ni de CANCEL) -- poser puis annuler ne coute rien. Le taux de
// reussite doit donc se lire dans le journal des tentatives, pas dans l'argent.

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "up" | "down" | "warn";
  hint?: string;
}) {
  const color =
    tone === "up"
      ? "text-emerald-400"
      : tone === "down"
        ? "text-red-400"
        : tone === "warn"
          ? "text-amber-400"
          : "text-zinc-100";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] leading-tight text-zinc-600">{hint}</div>}
    </div>
  );
}

/** Barre de repartition facon releve bancaire : une seule ligne, part par part. */
export function Bar({ parts }: { parts: { label: string; n: number; className: string }[] }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        {parts
          .filter((p) => p.n > 0)
          .map((p) => (
            <div
              key={p.label}
              className={p.className}
              style={{ width: `${(100 * p.n) / total}%` }}
              title={`${p.label} : ${p.n}`}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${p.className}`} />
            {p.label}
            <span className="tabular-nums text-zinc-300">{p.n}</span>
          </div>
        ))}
      </div>
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
  preopen: boolean;
};

type Attempt = {
  ts: number;
  symbol: string;
  slug: string;
  issue: "both" | "solo" | "none" | "rejected";
  combined?: number;
  shares?: number;
  cost?: number;
  imbalance?: number;
  tick?: number | null;
};

export function fmtTime(ts: number | null | undefined) {
  if (!ts) return "-";
  try {
    return new Date(ts * 1000).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

const ISSUE_META: Record<Attempt["issue"], { label: string; sub: string; cls: string }> = {
  both: { label: "Verrouille", sub: "les 2 jambes remplies, zero frais", cls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20" },
  solo: { label: "Une seule jambe", sub: "soldee avant l'ouverture", cls: "text-amber-300 bg-amber-500/10 ring-amber-500/20" },
  none: { label: "Non rempli", sub: "annule -- cout zero", cls: "text-zinc-400 bg-white/5 ring-white/10" },
  rejected: { label: "Refuse", sub: "ordre rejete -- cout zero", cls: "text-zinc-400 bg-white/5 ring-white/10" },
};

function PairTable({ pairs }: { pairs: Pair[] }) {
  if (!pairs.length)
    return (
      <Card>
        <div className="text-xs text-zinc-500">Aucune paire a afficher.</div>
      </Card>
    );
  return (
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
          {pairs.map((p) => (
            <tr key={p.slug} className="border-t border-white/5">
              <td className="py-1.5 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-zinc-200">{p.symbol}</span>
                  {p.preopen && (
                    <span className="rounded-full bg-sky-500/10 px-1.5 py-px text-[9.5px] font-medium text-sky-300 ring-1 ring-sky-500/20">
                      pre-ouv.
                    </span>
                  )}
                </div>
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
  );
}

function PreopenSection({ po, onReload }: { po: any; onReload: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!po) return null;

  const attempts = po.attempts ?? 0;
  const rate = po.fill_rate_pct;
  const recent: Attempt[] = po.recent ?? [];

  async function setTick(t: number) {
    setBusy(true);
    try {
      await fetch("/admin/mmtrade/preopen-tick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tick: t }),
      });
      onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tete facon compte bancaire : le chiffre qui compte, en grand. */}
      <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/[0.08] to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-sky-300/70">
              Cout des tentatives ratees
            </div>
            <div className="mt-1 text-4xl font-semibold tabular-nums text-emerald-400">0.00 $</div>
            <div className="mt-1.5 max-w-md text-[11px] leading-relaxed text-zinc-400">
              Ce n&apos;est pas une approximation. Polymarket ne regle que les trades{" "}
              <strong className="text-zinc-300">executes</strong> : poser un ordre puis l&apos;annuler ne
              produit aucun evenement on-chain, donc aucun mouvement de solde et aucun frais.
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Etat</div>
            <div className={`mt-1 text-sm font-semibold ${po.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
              {po.enabled ? "actif" : "inactif"}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-600">{(po.symbols ?? []).join(", ") || "-"}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Tentatives"
          value={attempts}
          hint="fenetres sur lesquelles on a pose"
        />
        <StatTile
          label="Taux de verrouillage"
          value={rate != null ? `${rate}%` : "-"}
          tone={rate >= 50 ? "up" : rate >= 25 ? "warn" : rate != null ? "down" : undefined}
          hint={`${po.locked} verrouillees`}
        />
        <StatTile
          label="Remplissages partiels"
          value={po.solo ?? 0}
          tone={(po.solo ?? 0) > 0 ? "warn" : "up"}
          hint="la SEULE source de perte"
        />
        <StatTile
          label="Capital engage"
          value={`${(po.engaged_usd ?? 0).toFixed(2)}$`}
          hint="uniquement sur les fenetres remplies"
        />
      </div>

      <Card>
        <div className="mb-3 text-xs font-medium text-zinc-300">Devenir des tentatives</div>
        <Bar
          parts={[
            { label: "Verrouillees", n: po.locked ?? 0, className: "bg-emerald-500" },
            { label: "Partielles", n: po.solo ?? 0, className: "bg-amber-500" },
            { label: "Sans suite (gratuit)", n: po.free_misses ?? 0, className: "bg-zinc-600" },
          ]}
        />
        <div className="mt-3 border-t border-white/5 pt-2.5 text-[11px] leading-relaxed text-zinc-500">
          Seules les <span className="text-amber-300">partielles</span> peuvent perdre de
          l&apos;argent : une jambe remplie, l&apos;autre non, qu&apos;il faut solder avant
          l&apos;ouverture. Les <span className="text-zinc-300">sans suite</span> sont neutres, ce qui
          rend le mecanisme peu couteux a tenter souvent.
        </div>
      </Card>

      {/* Reglage du tick : la question de Steven "on pourrait ptt +2". */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-zinc-300">Agressivite de la pose</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              On ameliore le meilleur bid pour passer en tete de file. La pose ne franchit jamais
              l&apos;ask : au-dela, on redeviendrait taker et on reperdrait les frais economises.
            </div>
          </div>
          <div className="flex gap-1.5">
            {[0, 0.01, 0.02].map((t) => (
              <button
                key={t}
                disabled={busy}
                onClick={() => setTick(t)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium tabular-nums transition disabled:opacity-40 ${
                  Math.abs((po.tick ?? 0.01) - t) < 0.001
                    ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30"
                    : "bg-white/[0.03] text-zinc-400 ring-1 ring-white/8 hover:bg-white/8"
                }`}
              >
                bid{t === 0 ? "" : `+${Math.round(t * 100)}`}
              </button>
            ))}
          </div>
        </div>
        {(po.by_tick ?? []).length > 0 && (
          <div className="mt-3 overflow-x-auto border-t border-white/5 pt-3">
            <table className="w-full min-w-[380px] text-left text-[11.5px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-zinc-500">
                  <th className="pb-1.5 pr-3 font-medium">Reglage</th>
                  <th className="pb-1.5 pr-3 font-medium">Tentatives</th>
                  <th className="pb-1.5 pr-3 font-medium">Verrouillees</th>
                  <th className="pb-1.5 pr-3 font-medium">Partielles</th>
                  <th className="pb-1.5 font-medium">Reussite</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {(po.by_tick ?? []).map((d: any) => (
                  <tr key={d.tick} className="border-t border-white/5">
                    <td className="py-1.5 pr-3 font-medium tabular-nums text-zinc-200">{d.tick}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-zinc-400">{d.attempts}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-emerald-400">{d.both}</td>
                    <td className={`py-1.5 pr-3 tabular-nums ${d.solo > 0 ? "text-amber-400" : "text-zinc-500"}`}>
                      {d.solo}
                    </td>
                    <td className="py-1.5 tabular-nums text-zinc-200">
                      {d.fill_rate_pct != null ? `${d.fill_rate_pct}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
              Comparer deux reglages demande des dizaines de tentatives par ligne. En dessous, un
              ecart de taux ne veut rien dire.
            </div>
          </div>
        )}
      </Card>

      {/* Releve : une ligne par tentative, y compris celles qui n'ont rien coute. */}
      <Card className="p-0">
        <div className="px-4 pb-2 pt-4 text-xs font-medium text-zinc-300">
          Releve des tentatives
          <span className="ml-2 font-normal text-zinc-600">
            les echecs sont invisibles dans le PnL, ils n&apos;apparaissent qu&apos;ici
          </span>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 pb-4 text-xs text-zinc-500">
            Aucune tentative enregistree pour l&apos;instant. Le journal demarre au prochain
            redemarrage du bot.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recent.map((a, i) => {
              const m = ISSUE_META[a.issue] ?? ISSUE_META.none;
              const paid = a.issue === "both" || a.issue === "solo" ? (a.cost ?? 0) : 0;
              return (
                <div key={`${a.slug}-${a.ts}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] font-medium text-zinc-200">{a.symbol}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${m.cls}`}
                      >
                        {m.label}
                      </span>
                      {a.tick != null && (
                        <span className="text-[10px] tabular-nums text-zinc-600">
                          bid+{Math.round(a.tick * 100)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-zinc-600">
                      {fmtTime(a.ts)} — {m.sub}
                      {a.combined != null && ` — combine ${a.combined.toFixed(3)}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-[12.5px] font-semibold tabular-nums ${
                        paid > 0 ? "text-zinc-200" : "text-zinc-600"
                      }`}
                    >
                      {paid > 0 ? `${paid.toFixed(2)} $` : "0.00 $"}
                    </div>
                    {a.imbalance != null && (
                      <div
                        className={`text-[10px] tabular-nums ${
                          a.imbalance > 1.2 ? "text-amber-400" : "text-zinc-600"
                        }`}
                      >
                        {a.imbalance.toFixed(2)}x
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="text-xs font-medium text-zinc-400">Paires issues de la pre-ouverture</div>
      <PairTable pairs={po.pairs ?? []} />
    </div>
  );
}

export function ArbQualityTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"all" | "preopen" | "problems">("all");
  const [muted, setMuted] = useState(true); // demarre muet -- l'audio du navigateur
  // exige un geste utilisateur avant de pouvoir jouer un son de toute facon.

  // SUIVI DES EVENEMENTS DEJA NOTIFIES (gain/perte) : sans ca, chaque
  // rafraichissement de page rejouerait un son pour les 60 dernieres entrees
  // du journal d'un coup. On memorise ce qu'on a deja vu, et seul ce qui
  // arrive APRES le premier chargement declenche un son.
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("mmtrade_sound_muted") !== "0");
    } catch {}
  }, []);

  function toggleMuted() {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("mmtrade_sound_muted", next ? "1" : "0");
      } catch {}
      if (!next) {
        // deverrouille l'audio sur ce geste utilisateur (Chrome/Safari
        // bloquent la lecture sans interaction prealable)
        _ctx();
      }
      return next;
    });
  }

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

  // DECLENCHEMENT DU SON : sur chaque nouvelle donnee, on regarde le journal
  // maker-ouvert (BTC/ETH, le mecanisme actif) pour des entrees jamais vues
  // avec un net non nul, et on joue le son correspondant.
  useEffect(() => {
    const recent: any[] = data?.preopen?.maker_open?.recent ?? [];
    if (!recent.length) return;
    if (!initializedRef.current) {
      // premier chargement : on memorise tout sans rien jouer
      recent.forEach((r) => seenRef.current.add(`${r.slug}-${r.ts}`));
      initializedRef.current = true;
      return;
    }
    const nouveaux = recent.filter((r) => !seenRef.current.has(`${r.slug}-${r.ts}`));
    nouveaux.forEach((r) => seenRef.current.add(`${r.slug}-${r.ts}`));
    if (muted || !nouveaux.length) return;
    // du plus ancien au plus recent, pour que l'ordre des sons suive l'ordre reel
    [...nouveaux].reverse().forEach((r, i) => {
      const net = typeof r.net === "number" ? r.net : 0;
      if (Math.abs(net) < 0.001) return;
      setTimeout(() => playAlert(net > 0 ? "gain" : "perte"), i * 260);
    });
  }, [data, muted]);

  const s = data?.summary;
  const pairs: Pair[] = data?.pairs ?? [];
  const po = data?.preopen;

  const TABS: { k: typeof view; label: string; badge?: number }[] = [
    { k: "all", label: "Vue d'ensemble" },
    { k: "preopen", label: "Pre-ouverture", badge: po?.attempts },
    { k: "problems", label: "Non verrouillees", badge: pairs.filter((p) => !p.locked).length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Qualite des arbs</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Le PnL seul ne dit pas si une paire etait un vrai arb garanti -- voir plus bas.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setView(t.k)}
            className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-medium transition ${
              view === t.k
                ? "bg-white/10 text-zinc-100 ring-1 ring-white/15"
                : "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/[0.06]"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 tabular-nums text-zinc-500">{t.badge}</span>
            )}
          </button>
        ))}
        <button
          onClick={toggleMuted}
          title={
            muted
              ? "Sons desactives -- cliquer pour activer les alertes gain/perte"
              : "Sons actives -- un carillon par gain ou perte reelle sur BTC/ETH"
          }
          className={`ml-auto rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
            muted
              ? "bg-white/[0.03] text-zinc-500 ring-1 ring-white/8 hover:bg-white/[0.06]"
              : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          }`}
        >
          {muted ? "🔇 Sons" : "🔊 Sons"}
        </button>
        <button
          onClick={load}
          className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20"
        >
          Rafraichir
        </button>
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
      ) : view === "preopen" ? (
        <PreopenSection po={po} onReload={load} />
      ) : (
        <>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-sky-300">
            Une paire n&apos;est un arb <strong>garanti</strong> que si le payout du pire cas depasse le
            cout total. Le gagnant paie 1$ <strong>par part</strong> : le pire cas vaut donc min(parts
            Up, parts Down). Un desequilibre de parts detruit le verrou meme quand les prix sont bons.
          </div>

          {s && view === "all" && (
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
                    <div
                      className={`mt-1 text-2xl font-semibold tabular-nums ${
                        (s.median_combined_nominal ?? 1) < 1 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {s.median_combined_nominal ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Effectif (apres sizing)</div>
                    <div
                      className={`mt-1 text-2xl font-semibold tabular-nums ${
                        (s.median_combined_effective ?? 1) < 1 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {s.median_combined_effective ?? "-"}
                    </div>
                  </div>
                </div>
                {s.median_combined_nominal != null && s.median_combined_effective != null && (
                  <div className="mt-2 text-[11px] text-zinc-500">
                    Ecart du au sizing :{" "}
                    <span
                      className={
                        s.median_combined_effective - s.median_combined_nominal > 0.02
                          ? "text-red-400"
                          : "text-emerald-400"
                      }
                    >
                      {(s.median_combined_effective - s.median_combined_nominal >= 0 ? "+" : "") +
                        (s.median_combined_effective - s.median_combined_nominal).toFixed(3)}
                    </span>
                    {" — au-dessus de 1.00, chaque paire perd de l'argent par construction."}
                  </div>
                )}
              </Card>
            </>
          )}

          <PairTable pairs={view === "problems" ? pairs.filter((p) => !p.locked) : pairs} />
        </>
      )}
    </div>
  );
}
