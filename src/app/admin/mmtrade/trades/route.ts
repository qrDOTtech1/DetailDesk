import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

// Proxy pour l'historique paginee/filtre/trie (Steven 04/08) : relais du
// /api/trades du bot (deja pagine/filtre/trie cote bot), meme principe que
// /stream et /curve -- le token ne quitte jamais le serveur.
export async function GET(req: NextRequest) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const qs = req.nextUrl.search; // deja au format ?page=..&symbol=..&mode=.. etc.
  const res = await fetch(`${base}/api/trades${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: `bot ${res.status}` }, { status: 502 });
  return Response.json(await res.json());
}
