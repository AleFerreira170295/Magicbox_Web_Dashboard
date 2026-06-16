"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MapPinned, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";

const locationMapMessages: Record<AppLanguage, {
  title: string;
  description: string;
  candidateLocations: (count: number) => string;
  mappedLocations: (count: number) => string;
  representedDevices: (count: number) => string;
  googleReady: string;
  fallbackReady: string;
  openInGoogleMaps: string;
  focusLocation: (label: string) => string;
  empty: string;
  resolving: string;
  unresolvedMap: string;
  institution: string;
  unresolvedCount: (count: number) => string;
}> = {
  es: {
    title: "Mapa de centros con dispositivos",
    description: "Google Maps con los centros que tienen dispositivos, calculado a partir de la dirección cargada en cada institución.",
    candidateLocations: (count) => `${count} ubicaciones candidatas`,
    mappedLocations: (count) => `${count} ubicadas en mapa`,
    representedDevices: (count) => `${count} dispositivos representados`,
    googleReady: "Google Maps activo con marcadores por centro.",
    fallbackReady: "Mapa activo con marcadores por centro y enlaces directos a Google Maps.",
    openInGoogleMaps: "Abrir en Google Maps",
    focusLocation: (label) => `Centrar mapa en ${label}`,
    empty: "Todavía no hay centros con dispositivos y dirección suficiente para dibujar el mapa. Cuando las instituciones tengan dirección cargada, aparecerán acá.",
    resolving: "Ubicando direcciones en el mapa...",
    unresolvedMap: "Encontré direcciones candidatas, pero no pude convertirlas en coordenadas todavía. Igual te dejo el resumen de ubicaciones al costado para verificar qué falta completar.",
    institution: "Institución",
    unresolvedCount: (count) => `${count} ubicaciones siguen sin coordenadas. Normalmente se resuelve completando calle, ciudad y país en la institución.`,
  },
  en: {
    title: "Map of centers with devices",
    description: "Google Maps view of centers with devices, calculated from each institution's saved address.",
    candidateLocations: (count) => `${count} candidate locations`,
    mappedLocations: (count) => `${count} mapped locations`,
    representedDevices: (count) => `${count} represented devices`,
    googleReady: "Google Maps is active with markers by center.",
    fallbackReady: "Map is active with center markers and direct Google Maps links.",
    openInGoogleMaps: "Open in Google Maps",
    focusLocation: (label) => `Center map on ${label}`,
    empty: "There are not enough centers with devices and complete addresses yet to draw the map. Once institutions have saved addresses, they will appear here.",
    resolving: "Resolving addresses on the map...",
    unresolvedMap: "I found candidate addresses, but I couldn't turn them into coordinates yet. I still left the location summary on the side so you can verify what is missing.",
    institution: "Institution",
    unresolvedCount: (count) => `${count} locations still have no coordinates. This is usually solved by completing street, city, and country on the institution.`,
  },
  pt: {
    title: "Mapa de centros com dispositivos",
    description: "Google Maps com os centros que têm dispositivos, calculado a partir do endereço cadastrado em cada instituição.",
    candidateLocations: (count) => `${count} localizações candidatas`,
    mappedLocations: (count) => `${count} localizações no mapa`,
    representedDevices: (count) => `${count} dispositivos representados`,
    googleReady: "Google Maps ativo com marcadores por centro.",
    fallbackReady: "Mapa ativo com marcadores por centro e links diretos ao Google Maps.",
    openInGoogleMaps: "Abrir no Google Maps",
    focusLocation: (label) => `Centralizar mapa em ${label}`,
    empty: "Ainda não há centros com dispositivos e endereço suficiente para desenhar o mapa. Quando as instituições tiverem endereço cadastrado, elas aparecerão aqui.",
    resolving: "Localizando endereços no mapa...",
    unresolvedMap: "Encontrei endereços candidatos, mas ainda não consegui convertê-los em coordenadas. Mesmo assim, deixei o resumo das localizações ao lado para verificar o que falta completar.",
    institution: "Instituição",
    unresolvedCount: (count) => `${count} localizações seguem sem coordenadas. Normalmente isso se resolve completando rua, cidade e país na instituição.`,
  },
};

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

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_SCRIPT_ID = "magicbox-google-maps-script";

type GoogleMapsLatLngLiteral = { lat: number; lng: number };
type GoogleMapsMarker = {
  setMap: (map: null) => void;
  addListener: (eventName: string, callback: () => void) => void;
};
type GoogleMapsInfoWindow = {
  open: (options: { anchor: GoogleMapsMarker; map: unknown }) => void;
};
type GoogleMapsMap = {
  fitBounds?: (bounds: unknown, padding?: number) => void;
  panTo: (point: GoogleMapsLatLngLiteral) => void;
  setCenter: (point: GoogleMapsLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};
type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: { center: GoogleMapsLatLngLiteral; zoom: number; mapTypeControl?: boolean; streetViewControl?: boolean; fullscreenControl?: boolean }) => GoogleMapsMap;
  Marker: new (options: { position: GoogleMapsLatLngLiteral; map: GoogleMapsMap; title: string; label?: { text: string; color: string; fontWeight: string } }) => GoogleMapsMarker;
  LatLngBounds: new () => { extend: (point: GoogleMapsLatLngLiteral) => void };
  InfoWindow: new (options: { content: string }) => GoogleMapsInfoWindow;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNamespace };
    __magicboxGoogleMapsPromise?: Promise<GoogleMapsNamespace>;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] || char));
}

function googleMapsSearchUrl(location: { geocode?: GeocodedLocation | null; query: string }) {
  const query = location.geocode ? `${location.geocode.lat},${location.geocode.lon}` : location.query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleMapsEmbedUrl(location: { geocode?: GeocodedLocation | null; query: string }, zoom = 10) {
  const query = location.geocode ? `${location.geocode.lat},${location.geocode.lon}` : location.query;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

function loadGoogleMapsScript() {
  if (!GOOGLE_MAPS_API_KEY || typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__magicboxGoogleMapsPromise) return window.__magicboxGoogleMapsPromise;

  window.__magicboxGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google?.maps as GoogleMapsNamespace));
      existingScript.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(window.google?.maps as GoogleMapsNamespace));
    script.addEventListener("error", reject);
    document.head.appendChild(script);
  });

  return window.__magicboxGoogleMapsPromise;
}

export function DashboardLocationMapCard({
  title,
  description,
  locations,
  isLoading = false,
}: {
  title?: string;
  description?: string;
  locations: DashboardLocationSeed[];
  isLoading?: boolean;
}) {
  const { language } = useLanguage();
  const t = locationMapMessages[language];
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<GoogleMapsMap | null>(null);
  const markersRef = useRef<GoogleMapsMarker[]>([]);
  const [results, setResults] = useState<Record<string, GeocodedLocation>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);

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

  const primaryLocation = geocodedLocations[0] || sortedLocations[0] || null;
  const selectedLocation = useMemo(
    () => sortedLocations.find((location) => location.key === selectedLocationKey) || null,
    [selectedLocationKey, sortedLocations],
  );
  const selectedGeocodedLocation = useMemo(
    () => geocodedLocations.find((location) => location.key === selectedLocationKey) || null,
    [geocodedLocations, selectedLocationKey],
  );
  const fallbackMapCenter = useMemo(() => {
    if (geocodedLocations.length === 0) return primaryLocation;
    const lat = geocodedLocations.reduce((sum, location) => sum + (location.geocode?.lat || 0), 0) / geocodedLocations.length;
    const lon = geocodedLocations.reduce((sum, location) => sum + (location.geocode?.lon || 0), 0) / geocodedLocations.length;
    return {
      key: "map-center",
      label: "Map center",
      query: `${lat},${lon}`,
      detail: "",
      kind: "institution" as const,
      deviceCount: 0,
      institutionCount: 0,
      geocode: { key: "map-center", query: `${lat},${lon}`, lat, lon },
    };
  }, [geocodedLocations, primaryLocation]);
  const mapDisplayLocation = selectedGeocodedLocation || selectedLocation || fallbackMapCenter || primaryLocation;
  const shouldUseGoogleJsMap = GOOGLE_MAPS_API_KEY && geocodedLocations.length > 0 && !mapError;

  useEffect(() => {
    if (!selectedLocationKey) return;
    if (sortedLocations.some((location) => location.key === selectedLocationKey)) return;
    setSelectedLocationKey(null);
  }, [selectedLocationKey, sortedLocations]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element || geocodedLocations.length === 0 || !GOOGLE_MAPS_API_KEY) return;

    let cancelled = false;

    async function renderGoogleMap() {
      try {
        const maps = await loadGoogleMapsScript();
        if (!maps || cancelled || !mapElementRef.current) return;

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        const first = selectedGeocodedLocation || geocodedLocations[0];
        const center = { lat: first.geocode?.lat || 0, lng: first.geocode?.lon || 0 };
        const map = new maps.Map(mapElementRef.current, {
          center,
          zoom: selectedGeocodedLocation ? 14 : geocodedLocations.length === 1 ? 12 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        googleMapRef.current = map;
        const bounds = new maps.LatLngBounds();

        for (const location of geocodedLocations) {
          const geocode = location.geocode;
          if (!geocode) continue;
          const position = { lat: geocode.lat, lng: geocode.lon };
          bounds.extend(position);
          const marker = new maps.Marker({
            position,
            map,
            title: location.label,
            label: { text: String(location.deviceCount), color: "#ffffff", fontWeight: "700" },
          });
          const infoWindow = new maps.InfoWindow({
            content: `
              <div style="max-width:240px;font-family:Inter,Arial,sans-serif">
                <strong>${escapeHtml(location.label)}</strong>
                <div style="margin-top:4px;color:#475569">${escapeHtml(location.detail)}</div>
                <div style="margin-top:6px;color:#0f172a">${location.deviceCount} devices</div>
              </div>
            `,
          });
          marker.addListener("click", () => infoWindow.open({ anchor: marker, map }));
          markersRef.current.push(marker);
        }

        if (!selectedGeocodedLocation && geocodedLocations.length > 1 && map.fitBounds) {
          map.fitBounds(bounds, 64);
        }
        setMapError(false);
      } catch {
        setMapError(true);
      }
    }

    void renderGoogleMap();

    return () => {
      cancelled = true;
      googleMapRef.current = null;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [geocodedLocations, selectedGeocodedLocation]);

  useEffect(() => {
    if (!shouldUseGoogleJsMap || !selectedGeocodedLocation?.geocode || !googleMapRef.current) return;
    const point = { lat: selectedGeocodedLocation.geocode.lat, lng: selectedGeocodedLocation.geocode.lon };
    googleMapRef.current.panTo(point);
    googleMapRef.current.setZoom(14);
  }, [selectedGeocodedLocation, shouldUseGoogleJsMap]);

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardHeader>
        <CardTitle>{title || t.title}</CardTitle>
        <CardDescription>{description || t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t.candidateLocations(locations.length)}</Badge>
          <Badge variant="outline">{t.mappedLocations(geocodedLocations.length)}</Badge>
          <Badge variant="outline">{t.representedDevices(locations.reduce((sum, location) => sum + location.deviceCount, 0))}</Badge>
        </div>

        {isLoading ? (
          <Skeleton className="h-[380px] rounded-3xl" />
        ) : locations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-sm text-muted-foreground">
            {t.empty}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-muted/20">
              {shouldUseGoogleJsMap ? (
                <div ref={mapElementRef} className="h-[420px] w-full bg-muted" />
              ) : mapDisplayLocation ? (
                <iframe
                  title={title || t.title}
                  src={googleMapsEmbedUrl(mapDisplayLocation, selectedLocationKey ? 15 : 10)}
                  className="h-[420px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="h-[420px] w-full bg-muted" />
              )}

              {isResolving ? (
                <div className="pointer-events-none absolute inset-x-6 top-6 rounded-2xl bg-white/90 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                  {t.resolving}
                </div>
              ) : null}

              {geocodedLocations.length === 0 ? (
                <div className="absolute inset-6 flex items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/75 p-6 text-center text-sm text-muted-foreground backdrop-blur-sm">
                  {t.unresolvedMap}
                </div>
              ) : null}

              <div className="absolute right-4 bottom-4 max-w-[min(360px,calc(100%-2rem))] rounded-2xl bg-white/92 px-4 py-3 text-xs leading-5 text-muted-foreground shadow-sm backdrop-blur-sm">
                {shouldUseGoogleJsMap ? t.googleReady : t.fallbackReady}
              </div>
            </div>

            <div className="space-y-3">
              <div className="max-h-[380px] space-y-3 overflow-auto pr-1">
                {sortedLocations.map((location) => {
                  const Icon = MapPinned;
                  const geocodedLocation = geocodedLocations.find((item) => item.key === location.key);
                  const isSelected = selectedLocationKey === location.key;
                  return (
                    <div
                      key={location.key}
                      className={`rounded-2xl border p-4 text-sm text-muted-foreground transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        isSelected
                          ? "border-primary/70 bg-primary/5 shadow-sm"
                          : "border-border/70 bg-white/85 hover:border-primary/45 hover:bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={t.focusLocation(location.label)}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedLocationKey(location.key)}
                        className="flex w-full items-start justify-between gap-3 text-left focus:outline-none"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-foreground">
                            <Icon className="size-4" />
                            <p className="truncate font-medium">{location.label}</p>
                          </div>
                          <p className="mt-1 text-xs leading-5">{location.detail}</p>
                          <p className="mt-2 text-xs leading-5 text-foreground/70">{location.query}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge variant="outline">{t.institution}</Badge>
                          <Badge variant="outline" className="inline-flex items-center gap-1">
                            <Smartphone className="size-3.5" />
                            {location.deviceCount}
                          </Badge>
                        </div>
                      </button>
                      <div className="mt-3 flex justify-end">
                        <a
                          href={googleMapsSearchUrl(geocodedLocation || location)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                          {t.openInGoogleMaps}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {unresolvedLocations.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground">
                  {t.unresolvedCount(unresolvedLocations.length)}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
