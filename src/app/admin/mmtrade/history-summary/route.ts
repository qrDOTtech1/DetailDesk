import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

export async function GET(req: Request) {
  await requirePlatformAdmin();
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  const base = normalizeBotUrl(rawBase);
  const { searchParams } = new URL(req.url);
  const hours = searchParams.get("hours") ?? "12";
  const res = await fetch(`${base}/api/history-summary?hours=${encodeURIComponent(hours)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ error: `bot ${res.status}` }, { status: 502 });
  return Response.json(await res.json());
}
