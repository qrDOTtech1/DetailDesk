"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

type Level = "erreur" | "avertissement" | "info" | "trade" | "autre";

// Classification par emoji/prefixe deja utilises par le bot lui-meme dans
// ses propres logs (Steven 04/08) : pas d'inference fragile sur le texte,
// juste les marqueurs que le bot pose systematiquement (⚠️, ❌, ✅, 💰, ⏱️...).
function classify(line: string): Level {
  if (/[❌🔴]/.test(line) || /erreur|exception|traceback/i.test(line)) return "erreur";
  if (/[⚠️]/.test(line)) return "avertissement";
  if (/[💰✅📈📉]/.test(line) || /trade|position|fill/i.test(line)) return "trade";
  if (/[ℹ️⚙️⏱️🔧]/.test(line)) return "info";
  return "autre";
}

const LEVEL_STYLE: Record<Level, string> = {
  erreur: "text-red-400",
  avertissement: "text-amber-400",
  trade: "text-emerald-400",
  info: "text-sky-400",
  autre: "text-zinc-500",
};

const LEVEL_LABEL: Record<Level, string> = {
  erreur: "Erreurs",
  avertissement: "Avertissements",
  trade: "Trades",
  info: "Info",
  autre: "Autre",
};

// Journal enrichi (Steven 04/08, "dash massif + complet") : au-dela de la
// simple recherche texte deja presente, classification par niveau (calquee
// sur les emoji que le bot pose deja lui-meme dans chaque ligne, aucune
// heuristique inventee), compteurs par niveau, pause/reprise de
// l'auto-scroll, et surlignage du terme recherche.
export function JournalTab({ logs, connected }: { logs: string[]; connected: boolean }) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<Level | "tous">("tous");
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const classified = useMemo(() => logs.map((l) => ({ line: l, level: classify(l) })), [logs]);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { erreur: 0, avertissement: 0, info: 0, trade: 0, autre: 0 };
    for (const { level } of classified) c[level]++;
    return c;
  }, [classified]);

  const filtered = useMemo(() => {
    let list = classified;
    if (levelFilter !== "tous") list = list.filter((l) => l.level === levelFilter);
    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter((l) => l.line.toLowerCase().includes(needle));
    }
    return list;
  }, [classified, levelFilter, search]);

  // AUTO-PAUSE INTELLIGENT (Steven 05/08, "je suis automatiquement ramene a
  // la derniere ligne sans qu'on me laisse le temps de lire, meme quand
  // j'essaie de copier") : avant, l'auto-scroll ignorait totalement ce que
  // l'utilisateur etait en train de faire -- chaque nouvelle ligne poussee
  // par le flux SSE arrachait la vue vers le bas, y compris en pleine
  // selection de texte. Desormais : des que l'utilisateur scrolle
  // manuellement loin du bas, ou commence a cliquer/selectionner dans le
  // journal, l'auto-scroll se coupe tout seul -- pas besoin de penser a
  // decocher la case avant de lire. Un clic sur "reprendre" (ou re-cocher
  // la case) le relance.
  const NEAR_BOTTOM_PX = 48;
  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, autoScroll]);

  function handleManualScroll() {
    if (autoScroll && !isNearBottom()) {
      setAutoScroll(false);
    }
  }

  function handleSelectStart() {
    // coupe immediatement, sans attendre l'evenement scroll (qui peut ne
    // jamais se declencher si on selectionne sans bouger la molette).
    if (autoScroll) setAutoScroll(false);
  }

  function resumeAutoScroll() {
    setAutoScroll(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  function highlight(line: string) {
    if (!search.trim()) return line;
    const idx = line.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return line;
    return (
      <>
        {line.slice(0, idx)}
        <mark className="rounded bg-amber-500/30 text-amber-100">{line.slice(idx, idx + search.length)}</mark>
        {line.slice(idx + search.length)}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <button
          onClick={() => setLevelFilter("tous")}
          className={`rounded-xl border px-3 py-2 text-left transition ${
            levelFilter === "tous" ? "border-white/20 bg-white/10" : "border-white/8 bg-white/[0.02] hover:bg-white/5"
          }`}
        >
          <div className="text-[10.5px] text-zinc-500">Toutes lignes</div>
          <div className="text-lg font-semibold tabular-nums text-zinc-100">{logs.length}</div>
        </button>
        {(Object.keys(LEVEL_LABEL) as Level[]).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              levelFilter === lvl ? "border-white/20 bg-white/10" : "border-white/8 bg-white/[0.02] hover:bg-white/5"
            }`}
          >
            <div className="text-[10.5px] text-zinc-500">{LEVEL_LABEL[lvl]}</div>
            <div className={`text-lg font-semibold tabular-nums ${LEVEL_STYLE[lvl]}`}>{counts[lvl]}</div>
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans le journal..."
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
          />
          <span className="text-[11px] text-zinc-500">
            {filtered.length} / {logs.length} lignes
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => (e.target.checked ? resumeAutoScroll() : setAutoScroll(false))}
              className="accent-emerald-500"
            />
            auto-scroll
          </label>
          {!autoScroll && (
            <button
              onClick={resumeAutoScroll}
              className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
            >
              ⏸ en pause -- reprendre
            </button>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <input type="checkbox" checked={wrapLines} onChange={(e) => setWrapLines(e.target.checked)} className="accent-emerald-500" />
            retour a la ligne
          </label>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10.5px] text-zinc-500">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
            {connected ? "flux actif" : "deconnecte"}
          </span>
          <a
            href="/admin/mmtrade/logfile"
            className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/20"
          >
            Telecharger journal complet
          </a>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleManualScroll}
          onMouseDown={handleSelectStart}
          onTouchStart={handleSelectStart}
          className="max-h-[36rem] select-text overflow-y-auto rounded-lg bg-black/30 p-2 font-mono text-[10.5px] leading-relaxed"
        >
          {filtered.map((entry, i) => (
            <div key={i} className={`${wrapLines ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"} ${LEVEL_STYLE[entry.level]}`}>
              {highlight(entry.line)}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-zinc-600">Aucune ligne ne correspond a ces filtres.</div>}
        </div>
      </Card>
    </div>
  );
}
