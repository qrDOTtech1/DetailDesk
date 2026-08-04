import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

// Proxy SSE (Steven 04/08, "vrai temps reel comme SSE") : le bot expose deja
// /api/stream (push snapshot/clock/log a chaque changement), mais EventSource
// natif du navigateur ne peut PAS envoyer de header Authorization -> on ne
// peut pas laisser le navigateur s'y connecter directement sans exposer le
// token cote client. Ce Route Handler se connecte au bot COTE SERVEUR (token
// jamais expose), et relaie le flux tel quel au navigateur, qui lui se
// connecte ici en same-origin, sans avoir besoin d'aucun secret.
export async function GET() {
  await requirePlatformAdmin();

  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) {
    return new Response("MMTRADE_API_URL / MMTRADE_API_TOKEN non configures", { status: 503 });
  }
  const base = normalizeBotUrl(rawBase);

  const upstream = await fetch(`${base}/api/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(`bot stream ${upstream.status}`, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
