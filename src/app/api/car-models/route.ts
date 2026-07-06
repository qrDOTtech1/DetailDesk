import { NextResponse } from "next/server";

/**
 * Model autocomplete backed by the free NHTSA vPIC API, cached server-side
 * for 24h per make. Falls back to an empty list — the UI always allows free
 * text input.
 */
const cache = new Map<string, { at: number; models: string[] }>();
const TTL = 24 * 3600_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const make = (searchParams.get("make") ?? "").trim();
  if (!make || make.length > 60) return NextResponse.json({ models: [] });

  const key = make.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ models: hit.models });

  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const models: string[] = [...new Set(
      (data?.Results ?? []).map((r: { Model_Name?: string }) => String(r.Model_Name ?? "").trim()).filter(Boolean)
    )].sort() as string[];
    cache.set(key, { at: Date.now(), models });
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
