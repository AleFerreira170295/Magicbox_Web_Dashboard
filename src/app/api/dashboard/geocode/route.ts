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

const MAX_QUERIES_PER_REQUEST = 12;
const MAX_QUERY_LENGTH = 160;
const MAX_CACHE_ENTRIES = 512;
const GEOCODE_TIMEOUT_MS = 3_500;

const geocodeCache = new Map<string, GeocodeResult>();

function setCacheEntry(key: string, value: GeocodeResult) {
  if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = geocodeCache.keys().next().value;
    if (firstKey) geocodeCache.delete(firstKey);
  }
  geocodeCache.set(key, value);
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

async function geocodeQuery(key: string, query: string) {
  const cacheKey = key + "::" + query;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "accept-language": "es,en;q=0.8",
        "user-agent": "MagicBox Web Dashboard/1.0 (dashboard geocode)",
      },
      next: { revalidate: 60 * 60 * 24 },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = payload[0];
  if (!first?.lat || !first?.lon) {
    setCacheEntry(cacheKey, null);
    return null;
  }

  const result = {
    key,
    query,
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name,
  } satisfies Exclude<GeocodeResult, null>;

  setCacheEntry(cacheKey, result);
  return result;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({ queries: [] as GeocodeRequestItem[] }));
  const queries: GeocodeRequestItem[] = Array.isArray(body?.queries) ? body.queries : [];

  const sanitized = queries
    .map((item: GeocodeRequestItem) => ({
      key: String(item?.key || "").trim(),
      query: String(item?.query || "").trim(),
    }))
    .filter((item: { key: string; query: string }) => item.key && item.query && item.query.length <= MAX_QUERY_LENGTH)
    .slice(0, MAX_QUERIES_PER_REQUEST);

  const results: GeocodeResult[] = [];
  for (const item of sanitized) {
    results.push(await geocodeQuery(item.key, item.query));
  }

  return NextResponse.json({
    results: results.filter(Boolean),
  });
}
