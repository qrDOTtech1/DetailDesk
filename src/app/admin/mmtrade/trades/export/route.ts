import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../../botUrl";

// Proxy export CSV/JSON (Steven 04/08) : lien direct <a href>, la session
// admin (cookie) suffit cote navigateur, le token bot reste server-side ici.
export async function GET(req: NextRequest) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return new Response("MMTRADE_API_URL / MMTRADE_API_TOKEN non configures", { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const qs = req.nextUrl.search;
  const res = await fetch(`${base}/api/trades/export${qs}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok || !res.body) return new Response(`bot ${res.status}`, { status: 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/csv",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "attachment; filename=trades.csv",
    },
  });
}
