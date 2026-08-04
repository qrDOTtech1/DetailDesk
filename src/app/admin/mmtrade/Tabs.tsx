"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Tab = { label: string; content: React.ReactNode; badge?: number | string };

// Barre d'onglets etendue (Steven 04/08, "AUCUNE modestie n'est permise, on
// veut le MAX") : navigation clavier (fleches gauche/droite, Home/End),
// position collante en haut au scroll (utile vu le nombre d'onglets
// desormais present), memorisation du dernier onglet actif par session
// (sessionStorage, pas de fuite entre utilisateurs/appareils), et badges
// optionnels pour signaler un etat notable (ex. kill-switch declenche) sans
// avoir a ouvrir l'onglet.
export function Tabs({ tabs, storageKey = "mmtrade-active-tab" }: { tabs: Tab[]; storageKey?: string }) {
  const [active, setActive] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const idx = Number(saved);
        if (Number.isFinite(idx) && idx >= 0 && idx < tabs.length) setActive(idx);
      }
    } catch {
      // sessionStorage indisponible (SSR/navigation privee) -- reste sur l'onglet 0, sans planter.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, String(active));
    } catch {
      // idem -- best effort, jamais bloquant.
    }
  }, [active, hydrated, storageKey]);

  const safeActive = useMemo(() => Math.min(active, tabs.length - 1), [active, tabs.length]);

  function focusTab(idx: number) {
    setActive(idx);
    tabRefs.current[idx]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab((idx + 1) % tabs.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab((idx - 1 + tabs.length) % tabs.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sections du dashboard"
        className="sticky top-0 z-10 mb-3 flex gap-1 overflow-x-auto rounded-full bg-[#0a0a0d]/90 p-1 ring-1 ring-white/8 backdrop-blur-md"
      >
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            aria-selected={safeActive === i}
            tabIndex={safeActive === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              safeActive === i ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge !== null && t.badge !== 0 && t.badge !== "" && (
              <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9.5px] font-semibold text-red-300 ring-1 ring-red-500/30">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs[safeActive]?.content}
    </div>
  );
}
