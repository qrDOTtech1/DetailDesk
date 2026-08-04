"use client";
import { useState } from "react";
import {
  toggleMarketMaker,
  toggleDeltaNeutral,
  toggleUltrapoly,
  toggleUltrapolyReal,
  resetMarketMakerKill,
  razCounters,
  setArbBudget,
} from "./actions";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function ToggleButton({ label, on, killed, form, name }: { label: string; on: boolean; killed?: boolean; form: (fd: FormData) => void; name: string }) {
  return (
    <form action={form}>
      <input type="hidden" name={name} value={String(on)} />
      <button
        className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
          on ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/[0.03] text-zinc-400 ring-1 ring-white/8 hover:bg-white/8"
        }`}
      >
        <div className="flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[11px] font-normal">{on ? "ON" : "off"}{killed ? " (tue par kill-switch)" : ""}</span>
        </div>
      </button>
    </form>
  );
}

// Strategies avancees + zone danger (Steven 04/08, "dash massif + complet") :
// Market Maker, Delta Neutral, Ultrapoly, Ultrapoly reel -- distinctes de
// l'arb crypto 5min de la vue d'ensemble, deplacees ici dans leur propre
// onglet plutot que noyees dans l'overview, avec description de ce que
// chacune fait (le dash local expliquait ces strategies, le web ne le
// faisait pas). Le reset du kill MM et le RAZ des compteurs vivent ici,
// isoles derriere une confirmation -- jamais dans la vue principale.
export function StrategiesTab({ snapshot }: { snapshot: any }) {
  const [razArmed, setRazArmed] = useState(false);
  const [razDone, setRazDone] = useState(false);

  return (
    <div className="space-y-5">
      <Card>
        <div className="text-sm font-medium">Market Maker</div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Cotation continue des deux cotes (Up/Down) autour du prix mid, plutot que d&apos;attendre une opportunite
          d&apos;arb ponctuelle. Possede son propre kill-switch interne (independant du kill-switch global) qui
          coupe la strategie apres une serie de pertes -- ne se relance jamais tout seul.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleButton label="Market Maker" on={!!snapshot.mm?.enabled} killed={!!snapshot.mm?.killed} form={toggleMarketMaker} name="enabled" />
          {snapshot.mm?.killed && (
            <form action={resetMarketMakerKill}>
              <button className="w-full rounded-xl bg-amber-500/15 px-4 py-3 text-left text-sm font-medium text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25">
                Reinitialiser le kill du Market Maker
              </button>
            </form>
          )}
        </div>
        {snapshot.mm && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-400">
            <div>
              <div className="text-zinc-200 tabular-nums">{snapshot.mm.trades ?? 0}</div>trades
            </div>
            <div>
              <div className="text-zinc-200 tabular-nums">{snapshot.mm.consec_losses ?? 0}</div>pertes consec.
            </div>
            <div>
              <div className={(snapshot.mm.pnl ?? 0) >= 0 ? "text-emerald-400 tabular-nums" : "text-red-400 tabular-nums"}>
                {(snapshot.mm.pnl ?? 0) >= 0 ? "+" : ""}
                {Number(snapshot.mm.pnl ?? 0).toFixed(3)}$
              </div>
              pnl
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-medium">Delta Neutral</div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Construit une paire synthetique Up+Down dont l&apos;exposition nette au prix est proche de zero -- vise a
          capturer des inefficiences de pricing entre les deux jambes sans parier sur la direction du marche
          sous-jacent.
        </p>
        <div className="mt-3">
          <ToggleButton label="Delta Neutral" on={!!snapshot.dn?.enabled} form={toggleDeltaNeutral} name="enabled" />
        </div>
      </Card>

      <Card>
        <div className="text-sm font-medium">Ultrapoly</div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Mode d&apos;execution accelere pour les opportunites d&apos;arb detectees -- reduction du delai entre
          detection et tentative d&apos;ordre. &quot;Ultrapoly reel&quot; est le pendant qui autorise ce mode a
          engager du VRAI capital (distinct des modes paper/real par symbole de la vue d&apos;ensemble).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleButton label="Ultrapoly" on={!!snapshot.ultrapoly} form={toggleUltrapoly} name="enabled" />
          <ToggleButton label="Ultrapoly reel" on={!!snapshot.ultrapoly_real} form={toggleUltrapolyReal} name="enabled" />
        </div>
      </Card>

      <Card>
        <div className="text-sm font-medium">Budget arb par tentative</div>
        <div className="mt-1 text-[11px] text-zinc-500">Montant maximum engage sur une seule tentative d&apos;arbitrage.</div>
        <form action={setArbBudget} className="mt-3 flex items-center gap-2">
          <input
            name="arb_budget"
            type="number"
            step="0.5"
            min="0"
            defaultValue={snapshot.arb_budget}
            className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-100"
          />
          <span className="text-xs text-zinc-500">$ actuellement : {snapshot.arb_budget}$</span>
          <button className="ml-auto rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20">
            Enregistrer
          </button>
        </form>
      </Card>

      <Card className="border-red-500/20 bg-red-500/[0.04]">
        <div className="text-sm font-medium text-red-300">Zone danger</div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Remet a zero les compteurs/stats internes du bot (trades, PnL affiche, pertes consecutives...). Ne touche
          JAMAIS aux fonds reels, aux positions ouvertes, ni au mode de trading -- c&apos;est un reset d&apos;affichage/comptage,
          pas une action financiere. Double confirmation requise pour eviter un clic accidentel.
        </p>
        <div className="mt-3">
          {!razArmed ? (
            <button
              onClick={() => setRazArmed(true)}
              className="rounded-full bg-red-500/15 px-4 py-2 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-500/25"
            >
              Remettre a zero les compteurs...
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-300">Confirmer la remise a zero ?</span>
              <form
                action={async () => {
                  await razCounters();
                  setRazArmed(false);
                  setRazDone(true);
                  setTimeout(() => setRazDone(false), 4000);
                }}
              >
                <button className="rounded-full bg-red-500/25 px-3 py-1.5 text-[11px] font-medium text-red-200 ring-1 ring-red-500/40 transition hover:bg-red-500/35">
                  Oui, remettre a zero
                </button>
              </form>
              <button onClick={() => setRazArmed(false)} className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-white/10">
                Annuler
              </button>
            </div>
          )}
          {razDone && <div className="mt-2 text-[11px] text-emerald-400">Compteurs remis a zero.</div>}
        </div>
      </Card>
    </div>
  );
}
