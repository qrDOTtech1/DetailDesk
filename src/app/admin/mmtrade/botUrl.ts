// normalizeBotUrl (Steven 04/08) : "Failed to parse URL" en prod -- la valeur
// collee dans Railway etait un hostname nu (mmtv1.railway.internal) sans
// schema ni port, que fetch() ne peut pas parser tel quel. On tolere ce
// format au lieu de planter : ajoute http:// si absent, et le port par
// defaut du bot (8787) si aucun port n'est precise. Partage entre page.tsx
// (lectures) et actions.ts (Server Actions start/stop/mode/killswitch).
export function normalizeBotUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  const hasPort = /:\d+$/.test(u.replace(/^https?:\/\//i, ""));
  if (!hasPort) u = `${u}:8787`;
  return u;
}
