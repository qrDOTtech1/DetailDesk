import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

export async function GET(req: Request) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") ?? "";
  const maxPages = searchParams.get("max_pages") ?? "10";
  const res = await fetch(
    `${base}/api/copy-analysis?wallet=${encodeURIComponent(wallet)}&max_pages=${encodeURIComponent(maxPages)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return Response.json({ error: body.error || `bot ${res.status}` }, { status: res.status === 400 ? 400 : 502 });
  }
  return Response.json(await res.json());
}
