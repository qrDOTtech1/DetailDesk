import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

// Scan couteux cote bot (dizaines d'appels Polymarket, ~1-2min mesure) --
// desactive le cache Next et etend la duree max si la plateforme le lit
// (Vercel notamment).
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(req: Request) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1" ? "&refresh=1" : "";
  // scan couteux (~1-2min) cote bot -- timeout genereux
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 170_000);
  try {
    const res = await fetch(`${base}/api/copy-discover?dummy=1${refresh}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return Response.json({ error: `bot ${res.status}` }, { status: 502 });
    return Response.json(await res.json());
  } catch (e) {
    return Response.json({ error: `scan timeout ou echoue: ${e}` }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
