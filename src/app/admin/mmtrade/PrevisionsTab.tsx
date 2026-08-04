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

function fmtCountdown(secondsLeft: number) {
  const m = Math.floor(secondsLeft / 60);
  const s = Math.floor(secondsLeft % 60);
  return `${pad2(m)}:${pad2(s)}`;
}

// Horloge de cycle + "prevision" (Steven 04/08, "oublie pas les previsions") :
// PAS un modele de ML qui devine l'issue -- juste la lecture directe et
// honnete de /api/clock (deja calculee cote bot, WS live) : position dans le
// cycle 5min courant, zone de decision (90s -> 6s avant fermeture, la fenetre
// ou le bot est autorise a agir), et pour chaque symbole le prix LIVE compare
// au strike (prix d'ouverture du marche) -- ce qui donne la tendance actuelle
// Up/Down, pas une certitude. Absent du dash web avant cette iteration alors
// que present dans l'horloge du dash local.
export function PrevisionsTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSecondsLeft, setLocalSecondsLeft] = useState<number | null>(null);
  const lastFetchTs = useRef<number>(0);
  // Plus grand ecart prix/strike observe par symbole DEPUIS L'OUVERTURE DE
  // CET ONGLET (Steven 04/08) -- purement une trace locale de session, pas
  // une statistique persistee cote bot ; se remet a zero a chaque rechargement.
  const [maxDeltaBySym, setMaxDeltaBySym] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/admin/mmtrade/clock", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          if (d?.error) setError(d.error);
          else {
            setError(null);
            setData(d);
            if (typeof d.seconds_left === "number") {
              setLocalSecondsLeft(d.seconds_left);
              lastFetchTs.current = Date.now();
            }
            setMaxDeltaBySym((prev) => {
              const next = { ...prev };
              for (const [sym, info] of Object.entries<any>(d.per_symbol ?? {})) {
                if (!info) continue;
                const strike = Number(info.strike ?? 0);
                const price = Number(info.price ?? 0);
                const deltaPct = strike ? Math.abs(((price - strike) / strike) * 100) : 0;
                if (!next[sym] || deltaPct > next[sym]) next[sym] = deltaPct;
              }
              return next;
            });
          }
        })
        .catch((e) => !cancelled && setError(String(e)));
    };
    load();
    const pollId = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  // Decompte local fluide entre 2 refresh serveur (Steven 04/08) : le
  // polling toutes les 5s donnerait un affichage qui saute par paliers de
  // 5s -- on garde juste la reference (valeur+horodatage du dernier fetch)
  // et on force un re-render chaque seconde pour interpoler l'affichage.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
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
        <div className="text-xs text-zinc-500">Chargement de l&apos;horloge...</div>
      </Card>
    );
  }
  if (!data.active) {
    return (
      <Card>
        <div className="text-sm font-medium">Aucun cycle actif</div>
        <div className="mt-1 text-[11px] text-zinc-500">
          {data.cycles_analyzed ?? 0} cycles analyses depuis le demarrage du sampler. Decalage horloge :{" "}
          {data.clock_offset_ms ?? 0}ms.
        </div>
      </Card>
    );
  }

  const liveSecondsLeft = Math.max(0, (localSecondsLeft ?? data.seconds_left) - (Date.now() - lastFetchTs.current) / 1000);
  const inDecisionZone =
    liveSecondsLeft <= (data.decision_zone?.from_secs_left ?? 90) && liveSecondsLeft >= (data.decision_zone?.to_secs_left ?? 6);
  const progressPct = Math.min(100, Math.max(0, ((300 - liveSecondsLeft) / 300) * 100));

  const perSymbol: Record<string, any> = data.per_symbol ?? {};

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-zinc-500">Fenetre en cours ferme dans</div>
            <div className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${inDecisionZone ? "text-emerald-400" : "text-zinc-100"}`}>
              {fmtCountdown(liveSecondsLeft)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                inDecisionZone ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-zinc-500 ring-1 ring-white/10"
              }`}
            >
              {inDecisionZone ? "zone de decision active" : "hors zone de decision"}
            </span>
            <span className="text-[10.5px] text-zinc-600">
              zone : entre {data.decision_zone?.from_secs_left ?? 90}s et {data.decision_zone?.to_secs_left ?? 6}s avant fermeture
            </span>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full transition-[width] ${inDecisionZone ? "bg-emerald-500/70" : "bg-white/25"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10.5px] text-zinc-600">
          <span>ouverture du cycle</span>
          <span>{data.cycles_analyzed ?? 0} cycles analyses -- decalage horloge {data.clock_offset_ms ?? 0}ms</span>
          <span>fermeture</span>
        </div>
      </Card>

      <div>
        <div className="mb-2 text-sm font-medium">Tendance actuelle par symbole</div>
        <div className="mb-2 text-[11px] text-zinc-500">
          Comparaison prix live vs strike (prix d&apos;ouverture du marche) -- indique le sens ou le marche penche{" "}
          <em>actuellement</em>, pas une garantie de resultat final : ca peut retourner jusqu&apos;a la fermeture.
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(perSymbol).map(([sym, info]: [string, any]) => {
            if (!info) {
              return (
                <Card key={sym}>
                  <div className="text-xs font-semibold text-zinc-300">{sym}</div>
                  <div className="mt-2 text-[11px] text-zinc-600">pas de cycle actif</div>
                </Card>
              );
            }
            const strike = Number(info.strike ?? 0);
            const price = Number(info.price ?? 0);
            const deltaPct = strike ? ((price - strike) / strike) * 100 : 0;
            const leaning = deltaPct >= 0 ? "Up" : "Down";
            return (
              <Card key={sym}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">{sym}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      leaning === "Up" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-red-500/15 text-red-300 ring-1 ring-red-500/30"
                    }`}
                  >
                    penche {leaning}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-400">
                  <div>
                    <div className="text-zinc-200 tabular-nums">{strike.toFixed(2)}</div>strike
                  </div>
                  <div>
                    <div className="text-zinc-200 tabular-nums">{price.toFixed(2)}</div>live
                  </div>
                  <div>
                    <div className={`tabular-nums ${deltaPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {deltaPct >= 0 ? "+" : ""}
                      {deltaPct.toFixed(3)}%
                    </div>
                    ecart
                  </div>
                </div>
                <div className="mt-1 truncate text-[10px] text-zinc-600" title={info.slug}>
                  {info.slug}
                </div>
                <div className="mt-2 text-[10.5px] text-zinc-500">{fmtCountdown(info.seconds_left ?? 0)} restant sur ce marche</div>
              </Card>
            );
          })}
          {Object.keys(perSymbol).length === 0 && (
            <Card>
              <div className="text-xs text-zinc-500">Aucun symbole actif pour l&apos;instant.</div>
            </Card>
          )}
        </div>
      </div>

      {Object.keys(maxDeltaBySym).length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-medium">Plus grand ecart observe (cette session d&apos;affichage)</div>
          <p className="mb-2 text-[10.5px] text-zinc-600">
            Trace locale a cet onglet ouvert, pas une statistique persistee cote bot -- se remet a zero a chaque
            rechargement de page.
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(maxDeltaBySym)
              .sort((a, b) => b[1] - a[1])
              .map(([sym, delta]) => (
                <div key={sym} className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-center">
                  <div className="text-[10px] text-zinc-500">{sym}</div>
                  <div className="text-sm font-semibold tabular-nums text-zinc-100">{delta.toFixed(3)}%</div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
