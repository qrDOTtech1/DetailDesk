import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

// Proxy pour le zoom sur les courbes (Steven 04/08) : le bot accepte deja
// ?range= en secondes sur /api/curve, mais le navigateur ne peut pas y
// acceder directement (token). Relais server-side, meme principe que /stream.
export async function GET(req: NextRequest) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const range = req.nextUrl.searchParams.get("range") ?? "1800";
  const res = await fetch(`${base}/api/curve?range=${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: `bot ${res.status}` }, { status: 502 });
  return Response.json(await res.json());
}
