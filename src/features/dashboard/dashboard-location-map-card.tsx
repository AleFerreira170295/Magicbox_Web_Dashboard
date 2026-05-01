"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinned, MapPinHouse, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardLocationSeed = {
  key: string;
  label: string;
  query: string;
  detail: string;
  kind: "institution" | "home-device";
  deviceCount: number;
  institutionCount: number;
};

type GeocodedLocation = {
  key: string;
  query: string;
  lat: number;
  lon: number;
  displayName?: string;
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;

function projectLongitude(lon: number) {
  return ((lon + 180) / 360) * MAP_WIDTH;
}

function projectLatitude(lat: number) {
  return ((90 - lat) / 180) * MAP_HEIGHT;
}

export function DashboardLocationMapCard({
  title = "Mapa de instituciones y dispositivos",
  description = "Ubicación aproximada según la dirección de las instituciones y la dirección registrada en owners de dispositivos home.",
  locations,
  isLoading = false,
}: {
  title?: string;
  description?: string;
  locations: DashboardLocationSeed[];
  isLoading?: boolean;
}) {
  const [results, setResults] = useState<Record<string, GeocodedLocation>>({});
  const [isResolving, setIsResolving] = useState(false);

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => (b.deviceCount + b.institutionCount) - (a.deviceCount + a.institutionCount)).slice(0, 12),
    [locations],
  );

  useEffect(() => {
    if (sortedLocations.length === 0) {
      setResults({});
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function resolveLocations() {
      setIsResolving(true);
      try {
        const response = await fetch("/api/dashboard/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: sortedLocations.map((location) => ({ key: location.key, query: location.query })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Geocode request failed with status ${response.status}`);
        }

        const payload = await response.json() as { results?: GeocodedLocation[] };
        if (cancelled) return;

        setResults(
          Object.fromEntries(
            (payload.results || []).map((result) => [result.key, result]),
          ),
        );
      } catch {
        if (!cancelled) {
          setResults({});
        }
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    }

    void resolveLocations();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sortedLocations]);

  const geocodedLocations = useMemo(
    () => sortedLocations.map((location) => ({ ...location, geocode: results[location.key] || null })).filter((location) => Boolean(location.geocode)),
    [results, sortedLocations],
  );

  const unresolvedLocations = useMemo(
    () => sortedLocations.filter((location) => !results[location.key]),
    [results, sortedLocations],
  );

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{locations.length} ubicaciones candidatas</Badge>
          <Badge variant="outline">{geocodedLocations.length} ubicadas en mapa</Badge>
          <Badge variant="outline">{locations.reduce((sum, location) => sum + location.deviceCount, 0)} dispositivos representados</Badge>
        </div>

        {isLoading ? (
          <Skeleton className="h-[380px] rounded-3xl" />
        ) : locations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-sm text-muted-foreground">
            Todavía no hay direcciones suficientes para dibujar el mapa. Cuando las instituciones o los owners tengan dirección cargada, aparecerán acá.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-[radial-gradient(circle_at_top,#eff6ff_0%,#e2e8f0_45%,#cbd5e1_100%)] p-3">
              <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="h-[380px] w-full rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(241,245,249,0.92))]">
                {Array.from({ length: 5 }).map((_, index) => {
                  const y = ((index + 1) * MAP_HEIGHT) / 6;
                  return <line key={`lat-${y}`} x1="0" y1={y} x2={MAP_WIDTH} y2={y} stroke="rgba(148,163,184,0.35)" strokeDasharray="6 10" />;
                })}
                {Array.from({ length: 7 }).map((_, index) => {
                  const x = ((index + 1) * MAP_WIDTH) / 8;
                  return <line key={`lon-${x}`} x1={x} y1="0" x2={x} y2={MAP_HEIGHT} stroke="rgba(148,163,184,0.25)" strokeDasharray="6 10" />;
                })}
                <rect x="18" y="18" width={MAP_WIDTH - 36} height={MAP_HEIGHT - 36} rx="24" fill="none" stroke="rgba(51,65,85,0.14)" />

                {geocodedLocations.map((location, index) => {
                  const lon = location.geocode?.lon || 0;
                  const lat = location.geocode?.lat || 0;
                  const x = projectLongitude(lon);
                  const y = projectLatitude(lat);
                  const radius = Math.max(8, Math.min(18, 7 + location.deviceCount));
                  const isInstitution = location.kind === "institution";
                  const offsetY = index % 2 === 0 ? -14 : 20;
                  const offsetX = index % 3 === 0 ? 12 : -12;

                  return (
                    <g key={location.key} transform={`translate(${x},${y})`}>
                      <circle r={radius + 7} fill={isInstitution ? "rgba(37,99,235,0.12)" : "rgba(16,185,129,0.16)"} />
                      <circle r={radius} fill={isInstitution ? "#2563eb" : "#059669"} fillOpacity="0.92" stroke="white" strokeWidth="4" />
                      <text x={offsetX} y={offsetY} fontSize="20" fontWeight="700" fill="#0f172a">
                        {location.deviceCount}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {isResolving ? (
                <div className="pointer-events-none absolute inset-x-6 top-6 rounded-2xl bg-white/90 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                  Ubicando direcciones en el mapa...
                </div>
              ) : null}

              {geocodedLocations.length === 0 ? (
                <div className="absolute inset-6 flex items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/75 p-6 text-center text-sm text-muted-foreground backdrop-blur-sm">
                  Encontré direcciones candidatas, pero no pude convertirlas en coordenadas todavía. Igual te dejo el resumen de ubicaciones al costado para verificar qué falta completar.
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="max-h-[380px] space-y-3 overflow-auto pr-1">
                {sortedLocations.map((location) => {
                  const isInstitution = location.kind === "institution";
                  const Icon = isInstitution ? MapPinned : MapPinHouse;
                  return (
                    <div key={location.key} className="rounded-2xl border border-border/70 bg-white/85 p-4 text-sm text-muted-foreground">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-foreground">
                            <Icon className="size-4" />
                            <p className="truncate font-medium">{location.label}</p>
                          </div>
                          <p className="mt-1 text-xs leading-5">{location.detail}</p>
                          <p className="mt-2 text-xs leading-5 text-foreground/70">{location.query}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge variant="outline">{isInstitution ? "Institución" : "Owner home"}</Badge>
                          <Badge variant="outline" className="inline-flex items-center gap-1">
                            <Smartphone className="size-3.5" />
                            {location.deviceCount}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {unresolvedLocations.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground">
                  {unresolvedLocations.length} ubicaciones siguen sin coordenadas. Normalmente se resuelve completando calle, ciudad y país en institución u owner.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
