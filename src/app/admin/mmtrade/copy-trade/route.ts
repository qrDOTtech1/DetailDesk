import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "../botUrl";

async function botFetch(path: string, init?: RequestInit) {
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) {
    return Response.json({ error: "MMTRADE_API_URL / MMTRADE_API_TOKEN non configures" }, { status: 503 });
  }
  const base = normalizeBotUrl(rawBase);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: body.error || `bot ${res.status}` }, { status: 502 });
  return Response.json(body);
}

export async function GET() {
  await requirePlatformAdmin();
  return botFetch("/api/copy-trade/status");
}

// action=follow|unfollow|enabled, transmis en query pour rester simple cote
// client (memes conventions que les autres toggles du dashboard).
export async function POST(req: Request) {
  await requirePlatformAdmin();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const paths: Record<string, string> = {
    follow: "/api/copy-trade/follow",
    unfollow: "/api/copy-trade/unfollow",
    enabled: "/api/copy-trade/enabled",
  };
  const path = paths[action];
  if (!path) return Response.json({ error: "action invalide" }, { status: 400 });
  return botFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
