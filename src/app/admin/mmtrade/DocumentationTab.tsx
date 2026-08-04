"use client";
import { useState } from "react";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

type Entry = { term: string; body: React.ReactNode };
type Section = { title: string; entries: Entry[] };

const SECTIONS: Section[] = [
  {
    title: "Vue d'ensemble",
    entries: [
      {
        term: "Cash",
        body: "Solde USDC disponible sur le wallet de trading, lu directement on-chain (pas une valeur en cache indefiniment -- rafraichi a intervalle court).",
      },
      {
        term: "PnL reel total (interne)",
        body: (
          <>
            Somme des gains/pertes calcules par le bot pour tous les symboles en mode <code>real</code>. Peut diverger
            de la realite on-chain (deja observe : ecart de plusieurs dizaines de dollars) -- toujours verifier
            l&apos;onglet <strong>Historique reel (on-chain)</strong> avant une decision de capital.
          </>
        ),
      },
      {
        term: "Precheck",
        body: "Verification que le solde disponible depasse le plancher configure de 0.10$ -- si ce n'est pas le cas, le bot refuse d'engager du capital sur un nouveau trade.",
      },
      {
        term: "Plancher de capital",
        body: "Montant minimum que le bot ne doit jamais faire descendre en dessous en engageant du capital. Mettre 0 desactive completement la protection.",
      },
      {
        term: "Kill-switch global",
        body: (
          <>
            Coupe TOUS les modes de trading a <code>off</code> si un seuil est franchi (plancher cash, perte de
            session max, ou pertes consecutives max). Ne se relance <strong>jamais</strong> automatiquement -- reactiver
            les symboles est toujours une decision humaine explicite, meme apres avoir clique &quot;Reset&quot;.
          </>
        ),
      },
      {
        term: "Modes par symbole (off / paper / real)",
        body: (
          <>
            <code>off</code> = symbole desactive. <code>paper</code> = simule sans argent reel. <code>real</code> =
            engage du vrai capital. Le passage a <code>real</code> n&apos;est jamais fait automatiquement par le bot
            ou par cette interface -- c&apos;est toujours un clic explicite.
          </>
        ),
      },
      {
        term: "Opportunite",
        body: "Autorise un sizing Kelly agressif (mise plus grosse sur une entree jugee a forte conviction) pour ce symbole, au lieu d'un sizing fixe.",
      },
      {
        term: "Risk-free",
        body: "Mode d'arbitrage qui vise a n'ouvrir une position que quand les deux jambes (Up+Down) peuvent etre remplies a un cout combine garantissant un profit independamment du resultat final.",
      },
    ],
  },
  {
    title: "Previsions",
    entries: [
      {
        term: "Horloge de cycle",
        body: "Position dans la fenetre de marche 5 minutes courante, avec decompte jusqu'a la fermeture. Calculee cote bot a partir des slugs de marche actifs (pas d'estimation cote dashboard).",
      },
      {
        term: "Zone de decision",
        body: "Intervalle de temps (entre 90s et 6s avant fermeture, par defaut) pendant lequel le bot est autorise a evaluer et potentiellement declencher un arbitrage sur la fenetre en cours.",
      },
      {
        term: "Tendance actuelle",
        body: (
          <>
            Comparaison du prix live du sous-jacent avec le <em>strike</em> (prix d&apos;ouverture du marche). Un
            ecart positif penche vers <span className="text-emerald-400">Up</span>, negatif vers{" "}
            <span className="text-red-400">Down</span> -- c&apos;est une lecture de l&apos;etat courant, pas une
            garantie du resultat final : le marche peut retourner jusqu&apos;a la derniere seconde.
          </>
        ),
      },
    ],
  },
  {
    title: "Positions & Historique",
    entries: [
      {
        term: "Positions ouvertes",
        body: "Toute position dont l'ordre a ete rempli mais dont le marche n'est pas encore resolu. Chaque position affiche sa propre courbe de prix en direct depuis l'entree.",
      },
      {
        term: "Vue tableau vs cartes",
        body: "La vue cartes montre le detail visuel (sparkline) par position ; la vue tableau permet de trier rapidement par colonne (cout, parts, prix d'entree...) sur un grand nombre de positions.",
      },
      {
        term: "Repartition par symbole/mode/sens",
        body: "Barres de repartition calculees depuis /api/positions-stats (deja expose cote bot, jamais affiche cote dashboard avant cette iteration) -- avec repli sur un calcul local si l'endpoint est indisponible.",
      },
      {
        term: "Historique (trades clos)",
        body: "Filtrage par symbole, mode, resultat (gain/perte), plage de dates, et recherche texte libre. Export CSV disponible avec les memes filtres appliques.",
      },
      {
        term: "Historique reel (on-chain)",
        body: (
          <>
            Source : <code>data-api.polymarket.com/activity</code>, lecture seule et publique -- reflete exactement
            ce qui s&apos;est passe sur la blockchain, independamment de tout calcul interne du bot. Limite a 200
            transactions les plus recentes (limite de l&apos;API elle-meme).
          </>
        ),
      },
    ],
  },
  {
    title: "Latence & execution",
    entries: [
      {
        term: "Etapes mesurees (TOTAL, avant post, baseline, signature, soumission)",
        body: "Decomposition du chemin critique d'un ordre reel, du declenchement de la decision jusqu'a la reponse du serveur Polymarket. p50/p95/p99 mis en avant plutot que la seule mediane -- un p99 eleve avec un p50 flatteur signale des pics rares mais couteux.",
      },
      {
        term: "Signature Rust (sidecar)",
        body: (
          <>
            Service local (<code>enginebtb3_rust serve</code>) qui re-signe l&apos;ordre deja construit par Python,
            avec repli automatique sur la signature Python en cas d&apos;echec/timeout. Couvre les schemas EOA et
            POLY_1271 (le schema reellement utilise par ce compte, verifie signature par signature contre la sortie
            Python de reference). Le reseau (~330-360ms de RTT) domine largement le temps total -- le gain de
            signature seul est de l&apos;ordre de la microseconde.
          </>
        ),
      },
      {
        term: "Qualite d'execution",
        body: "Fill ratio (proportion de tentatives ou les deux jambes ont ete remplies), taux de remplissage partiel, EV net de fees et de slippage, fraicheur des donnees utilisees pour la decision.",
      },
      {
        term: "Excursion de prix",
        body: "Mouvement de prix (adverse = contre nous, favorable = pour nous) observe apres l'entree en position -- indique si les sorties/stop pourraient etre optimisees.",
      },
    ],
  },
  {
    title: "Strategies avancees",
    entries: [
      {
        term: "Market Maker",
        body: "Cotation continue des deux cotes autour du prix mid, plutot que d'attendre une opportunite ponctuelle. Possede son propre kill-switch interne, distinct du kill-switch global -- un reset manuel est necessaire pour le relancer apres declenchement.",
      },
      {
        term: "Delta Neutral",
        body: "Construit une paire synthetique Up+Down avec une exposition nette proche de zero au prix du sous-jacent -- cherche a capturer des inefficiences de pricing entre les deux jambes.",
      },
      {
        term: "Ultrapoly / Ultrapoly reel",
        body: "Mode d'execution accelere pour les opportunites detectees. Le suffixe 'reel' autorise ce mode a engager du vrai capital, independamment des modes par symbole de la vue d'ensemble.",
      },
      {
        term: "Zone danger (RAZ)",
        body: "Remet a zero les compteurs/statistiques internes affiches (trades, pertes consecutives...). Ne touche jamais aux fonds reels, positions ouvertes ou modes de trading -- double confirmation requise avant execution.",
      },
    ],
  },
  {
    title: "ENGINEBTB3",
    entries: [
      {
        term: "Statut",
        body: (
          <>
            Squelette explicitement en mode <code>paper</code>, sans logique d&apos;execution reelle branchee --
            construit comme structure pour une eventuelle extension future (copy-trading, consensus multi-marche,
            marches meteo) decrite dans le cahier des charges original du projet.
          </>
        ),
      },
      {
        term: "Actif",
        body: "Indicateur explicite si le module autorise l'execution reelle (false = aucun ordre ne peut partir depuis ce module, par construction du code).",
      },
    ],
  },
  {
    title: "Systeme",
    entries: [
      {
        term: "Explorateur JSON",
        body: "Snapshot brut complet renvoye par le bot -- utile pour diagnostiquer un champ manquant ou un comportement inattendu sans avoir besoin d'un acces SSH au serveur.",
      },
      {
        term: "Etat brut par symbole",
        body: "Vue tabulaire condensee de l'etat de chaque symbole (mode, trades, wins, positions ouvertes, pertes consecutives, statut stoppe) -- complementaire aux cartes de la vue d'ensemble.",
      },
    ],
  },
  {
    title: "Horloge plein ecran",
    entries: [
      {
        term: "Cadrans radiaux",
        body: "Un cadran par symbole, anneau qui se vide au fil des 300 secondes du cycle courant. La couleur passe au vert des l'entree en zone de decision (entre 90s et 6s avant fermeture) -- sinon bleu si le prix penche Up, rouge si Down.",
      },
      {
        term: "Portefeuille anime",
        body: "Le solde et le PnL affiches s'animent lors de chaque changement (transition douce), plutot que de sauter brutalement -- purement visuel, la valeur exacte reste identique a celle de la vue d'ensemble.",
      },
      {
        term: "Plein ecran",
        body: "Utilise l'API Fullscreen native du navigateur -- pensee pour rester affichee en continu sur un second ecran sans autre chrome d'interface autour.",
      },
    ],
  },
  {
    title: "Accessibilite & navigation",
    entries: [
      {
        term: "Navigation clavier des onglets",
        body: "Fleches gauche/droite pour circuler entre les onglets, Home/End pour aller directement au premier/dernier -- la barre d'onglets suit le pattern ARIA tablist standard.",
      },
      {
        term: "Onglet memorise",
        body: "Le dernier onglet ouvert est retenu pour la session de navigation (sessionStorage) -- un rafraichissement de page ne revient pas systematiquement a la vue d'ensemble.",
      },
      {
        term: "Badges d'alerte",
        body: "Un badge rouge sur l'onglet 'Vue d'ensemble' signale un kill-switch declenche sans avoir a l'ouvrir ; un badge sur 'Positions' indique le nombre de positions actuellement ouvertes.",
      },
      {
        term: "Recherche dans cette documentation",
        body: "Le champ de recherche en haut de cet onglet filtre instantanement les termes across toutes les sections -- utile pour retrouver rapidement l'explication d'un controle precis sans parcourir chaque section manuellement.",
      },
    ],
  },
  {
    title: "Journal",
    entries: [
      {
        term: "Recherche",
        body: "Filtre en direct sur les lignes deja chargees (cote client, instantane). Le flux temps reel continue d'ajouter les nouvelles lignes par-dessus le filtre actif.",
      },
      {
        term: "Telecharger journal complet",
        body: "Le journal affiche est plafonne a 5000 lignes recentes -- le fichier brut cote bot n'est lui jamais purge et reste telechargeable integralement.",
      },
      {
        term: "Classification par niveau",
        body: (
          <>
            Chaque ligne est classee (erreur / avertissement / trade / info / autre) a partir des marqueurs emoji que
            le bot pose deja lui-meme dans ses propres logs (<code>⚠️</code>, <code>❌</code>, <code>💰</code>,
            <code>⏱️</code>...) -- aucune heuristique de detection inventee cote dashboard, uniquement une lecture des
            conventions deja en place cote bot.
          </>
        ),
      },
    ],
  },
];

// Documentation integree (Steven 04/08, "dash massif + complet") : chaque
// controle du dashboard explique en francais, directement dans l'app --
// absent du dash local ET du dash web avant cette iteration. Contenu
// statique mais base uniquement sur des mecanismes reels du bot (aucune
// fonctionnalite inventee).
export function DocumentationTab() {
  const [openSection, setOpenSection] = useState<string | null>(SECTIONS[0]?.title ?? null);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filteredSections = needle
    ? SECTIONS.map((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.term.toLowerCase().includes(needle)),
      })).filter((s) => s.entries.length > 0)
    : SECTIONS;

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-sm font-medium">Documentation integree</div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Explication de chaque controle et onglet du dashboard, base uniquement sur des mecanismes reellement
          implementes cote bot.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un terme..."
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
        />
      </Card>

      {filteredSections.map((section) => {
        const isOpen = needle.length > 0 || openSection === section.title;
        return (
          <Card key={section.title}>
            <button
              onClick={() => setOpenSection(openSection === section.title ? null : section.title)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-zinc-200"
            >
              <span>{section.title}</span>
              <span className="text-zinc-500">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <dl className="mt-3 space-y-3 border-t border-white/5 pt-3">
                {section.entries.map((entry) => (
                  <div key={entry.term}>
                    <dt className="text-[12px] font-medium text-zinc-200">{entry.term}</dt>
                    <dd className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{entry.body}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        );
      })}

      {filteredSections.length === 0 && (
        <Card>
          <div className="text-xs text-zinc-500">Aucun terme ne correspond a &quot;{query}&quot;.</div>
        </Card>
      )}
    </div>
  );
}
