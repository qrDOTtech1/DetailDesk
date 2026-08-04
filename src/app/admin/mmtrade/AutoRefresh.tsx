"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Le dashboard bot original pousse en SSE (temps reel). Ici on est en Server
// Component (pas de socket persistant) -> on approxime avec un
// router.refresh() periodique (Steven 04/08). Pas du vrai push, mais
// suffisant pour un ecran de supervision qu'on regarde de temps en temps.
export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      router.refresh();
      setTick((t) => t + 1);
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [paused, seconds, router]);

  return (
    <button
      onClick={() => setPaused((p) => !p)}
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10"
      title={paused ? "Actualisation en pause" : `Actualise toutes les ${seconds}s`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-zinc-600" : "bg-emerald-400 animate-pulse"}`}
      />
      {paused ? "en pause" : `live · ${tick}`}
    </button>
  );
}
