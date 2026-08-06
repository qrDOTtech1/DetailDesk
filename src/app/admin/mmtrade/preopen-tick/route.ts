import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

// Regle a chaud l'amelioration du bid en pre-ouverture (bid+0 / +1 / +2).
// Le moteur refuse toujours de franchir l'ask : au-dela on redeviendrait
// taker, ce qui reperdrait les frais que le mecanisme existe pour economiser.
export async function POST(req: Request) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token)
    return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const body = await req.text();
  const res = await fetch(`${base}/api/preopen/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: `bot ${res.status}` }, { status: 502 });
  return Response.json(await res.json());
}
