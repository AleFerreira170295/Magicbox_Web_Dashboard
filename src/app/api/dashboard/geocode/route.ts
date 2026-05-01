import { NextRequest, NextResponse } from "next/server";

type GeocodeRequestItem = {
  key?: string;
  query?: string;
};

type GeocodeResult = {
  key: string;
  query: string;
  lat: number;
  lon: number;
  displayName?: string;
} | null;

const geocodeCache = new Map<string, GeocodeResult>();

async function geocodeQuery(key: string, query: string) {
  const cacheKey = `${key}::${query}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      "accept-language": "es,en;q=0.8",
      "user-agent": "MagicBox Web Dashboard/1.0 (dashboard geocode)",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = payload[0];
  if (!first?.lat || !first?.lon) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const result = {
    key,
    query,
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name,
  } satisfies Exclude<GeocodeResult, null>;

  geocodeCache.set(cacheKey, result);
  return result;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({ queries: [] as GeocodeRequestItem[] }));
  const queries: GeocodeRequestItem[] = Array.isArray(body?.queries) ? body.queries : [];

  const sanitized = queries
    .map((item: GeocodeRequestItem) => ({
      key: String(item?.key || "").trim(),
      query: String(item?.query || "").trim(),
    }))
    .filter((item: { key: string; query: string }) => item.key && item.query)
    .slice(0, 24);

  const results: GeocodeResult[] = [];
  for (const item of sanitized) {
    results.push(await geocodeQuery(item.key, item.query));
  }

  return NextResponse.json({
    results: results.filter(Boolean),
  });
}
