// normalizeBotUrl (Steven 04/08) : "Failed to parse URL" en prod -- la valeur
// collee dans Railway etait un hostname nu sans schema ni port, que fetch()
// ne peut pas parser tel quel. On tolere ce format au lieu de planter.
// Deux cas distincts (Steven 04/08, passage au domaine PUBLIC pour permettre
// a d'autres clients -- ESP32, autres dashboards -- de parler au bot) :
//  - domaine public Railway (*.up.railway.app) : https, PAS de port -- le
//    proxy edge de Railway route deja vers le bon port interne du conteneur.
//    Ajouter :8787 ici serait FAUX et casserait la connexion.
//  - reseau prive (*.railway.internal) ou tout autre host : http, port 8787
//    par defaut (pas de proxy edge, il faut le port explicite du conteneur).
// Partage entre page.tsx (lectures) et actions.ts (Server Actions).
export function normalizeBotUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  const isPublicRailway = /(^|\.)up\.railway\.app$/i.test(
    u.replace(/^https?:\/\//i, "").replace(/:\d+$/, "")
  );
  if (!/^https?:\/\//i.test(u)) u = `${isPublicRailway ? "https" : "http"}://${u}`;
  if (!isPublicRailway) {
    const hasPort = /:\d+$/.test(u.replace(/^https?:\/\//i, ""));
    if (!hasPort) u = `${u}:8787`;
  }
  return u;
}
