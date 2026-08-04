"use client";
import { useEffect, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

const LAYERS = [
  { key: "market_data", label: "Market data" },
  { key: "signals", label: "Signal" },
  { key: "execution", label: "Execution" },
  { key: "risk", label: "Risk" },
  { key: "review", label: "Post-trade review" },
  { key: "benchmark", label: "Benchmark" },
];

// ENGINEBTB3 (Steven 04/08) : squelette honnete -- statut PAPER affiche
// clairement partout, aucune fonction reelle derriere pour l'instant. Voir
// enginebtb3/ (bot) et ENGINEBTB3_SPEC.txt pour la spec complete. On ne
// pretend PAS que ca trade : chaque carte dit explicitement "non implemente".
export function EngineBTB3Tab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/admin/mmtrade/enginebtb3")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><div className="text-xs text-zinc-500">Chargement...</div></Card>;

  const status = data?.status ?? "error";
  const active = data?.active ?? false;
  const markets: string[] = data?.markets ?? [];
  const weatherMarkets: string[] = data?.weather_markets ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30">
          PAPER
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${active ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-zinc-500 ring-1 ring-white/10"}`}>
          {active ? "actif" : "inactif"}
        </span>
        {status === "error" && <span className="text-[11px] text-red-400">{data?.error}</span>}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500">
        Squelette en construction -- aucune logique de detection ou d&apos;execution reelle pour l&apos;instant.
        Chaque couche ci-dessous est un stub explicite. Rien de ce module n&apos;engage jamais de capital
        (garde-fou ACTIVE=False verifie dans execution.py, meme en paper).
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LAYERS.map((l) => (
          <Card key={l.key}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">{l.label}</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">stub</span>
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">Non implemente</div>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Marches crypto 5 min</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {markets.map((m) => (
            <Card key={m}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{m}</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">paper</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-600">pas encore actif</div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Marches meteo court terme</div>
        {weatherMarkets.length === 0 ? (
          <Card><div className="text-xs text-zinc-500">Pas encore scope -- voir ENGINEBTB3_SPEC.txt section &quot;marche&quot;.</div></Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {weatherMarkets.map((m) => (
              <Card key={m}>
                <span className="text-sm font-semibold">{m}</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
