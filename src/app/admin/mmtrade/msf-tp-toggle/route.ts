import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

// Interrupteur du TP sur MSF (Maker Sur Fenetre). OFF : la jambe seule
// attend le cutoff habituel comme avant l'existence du TP, sans jamais
// lire le carnet ni tenter de vendre en cours de route.
export async function POST(req: Request) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token)
    return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const body = await req.text();
  const res = await fetch(`${base}/api/msf/tp-toggle`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: `bot ${res.status}` }, { status: 502 });
  return Response.json(await res.json());
}
