"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, MapPinned, Radar, ShieldAlert, Siren, TrendingDown } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useSystemDashboardSummary } from "@/features/dashboard/api";
import { getErrorMessage } from "@/lib/utils";

type FocusPresetKey = "critical" | "score_lt_60" | "no_turns" | "high_population_low_activity";
const EMPTY_LIST: never[] = [];

function buildDashboardHref(searchParams: URLSearchParams, preset?: FocusPresetKey | "") {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("focus");
  if (preset) {
    params.set("smart_preset", preset);
  }
  return `/dashboard?${params.toString()}`;
}

export function TerritorialAlertsCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tokens } = useAuth();
  const selectedRange = searchParams.get("range") || "30d";
  const selectedCountryCode = searchParams.get("country_code");
  const selectedState = searchParams.get("state");
  const selectedCity = searchParams.get("city");
  const selectedUserType = searchParams.get("user_type");
  const selectedRoleCode = searchParams.get("role_code");
  const selectedFocus = (searchParams.get("focus") || "critical") as FocusPresetKey;
  const summaryFilters = {
    range: selectedRange,
    countryCode: selectedCountryCode,
    state: selectedState,
    city: selectedCity,
    userType: selectedUserType,
    roleCode: selectedRoleCode,
  };

  const summaryQuery = useSystemDashboardSummary(tokens?.accessToken, summaryFilters, true);
  const territoryAlerts = summaryQuery.data?.segments.territory_alerts ?? EMPTY_LIST;
  const territoryScores = summaryQuery.data?.segments.territory_scores ?? EMPTY_LIST;
  const rangeOptions = summaryQuery.data?.filters.range_options ?? EMPTY_LIST;

  const focusPresets = useMemo(
    () => [
      {
        key: "critical" as const,
        label: "Territorios críticos",
        description: "Alertas activas o score en warning.",
        count: territoryScores.filter((item) => item.status === "warning" || territoryAlerts.some((alert) => alert.label.includes(item.label))).length,
      },
      {
        key: "score_lt_60" as const,
        label: "Score < 60",
        description: "Territorios con señal compuesta débil.",
        count: territoryScores.filter((item) => item.score < 60).length,
      },
      {
        key: "no_turns" as const,
        label: "Sin turnos",
        description: "Usuarios visibles pero sin actividad de turnos.",
        count: territoryScores.filter((item) => item.users > 0 && item.turns === 0).length,
      },
      {
        key: "high_population_low_activity" as const,
        label: "Alta población, baja actividad",
        description: "Muchos usuarios con muy poco movimiento.",
        count: territoryScores.filter((item) => item.users >= 10 && item.turns / Math.max(item.users, 1) < 0.25).length,
      },
    ],
    [territoryAlerts, territoryScores],
  );

  const activePreset = focusPresets.find((preset) => preset.key === selectedFocus) || focusPresets[0];

  const filteredScores = useMemo(() => {
    switch (selectedFocus) {
      case "score_lt_60":
        return territoryScores.filter((item) => item.score < 60);
      case "no_turns":
        return territoryScores.filter((item) => item.users > 0 && item.turns === 0);
      case "high_population_low_activity":
        return territoryScores.filter((item) => item.users >= 10 && item.turns / Math.max(item.users, 1) < 0.25);
      case "critical":
      default:
        return territoryScores.filter((item) => item.status === "warning" || territoryAlerts.some((alert) => alert.label.includes(item.label)));
    }
  }, [selectedFocus, territoryAlerts, territoryScores]);

  const filteredAlerts = useMemo(() => {
    if (selectedFocus === "critical") return territoryAlerts;
    const allowed = new Set(filteredScores.map((item) => item.label));
    return territoryAlerts.filter((item) => [...allowed].some((label) => item.label.includes(label)));
  }, [filteredScores, selectedFocus, territoryAlerts]);

  const priorityCounters = useMemo(
    () => ({
      critical: territoryScores.filter((item) => item.status === "warning").length,
      secondary: territoryScores.filter((item) => item.status === "secondary").length,
      noTurns: territoryScores.filter((item) => item.users > 0 && item.turns === 0).length,
    }),
    [territoryScores],
  );

  function updateQuery(entries: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Gobierno"
        title="Alertas territoriales"
        description="Pantalla ejecutiva para detectar territorios con foco inmediato, ordenar prioridades y saltar al dashboard ya filtrado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Rango</span>
            <select
              value={selectedRange}
              onChange={(event) => updateQuery({ range: event.target.value })}
              className="h-10 min-w-32 rounded-md border border-input bg-background px-3 text-sm"
            >
              {rangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {focusPresets.map((preset) => {
          const Icon = preset.key === "critical"
            ? Siren
            : preset.key === "score_lt_60"
              ? TrendingDown
              : preset.key === "no_turns"
                ? ShieldAlert
                : Radar;
          const active = preset.key === activePreset.key;

          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => updateQuery({ focus: preset.key })}
              className={`rounded-3xl border p-5 text-left transition-all ${active ? "border-primary bg-primary/8 shadow-[0_18px_38px_rgba(71,185,239,0.18)]" : "border-border bg-card/90 hover:border-primary/35 hover:bg-card"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-primary/12 p-3 text-primary">
                  <Icon className="size-5" />
                </div>
                <Badge variant={active ? "default" : "outline"}>{preset.count}</Badge>
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">{preset.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{preset.description}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Focos priorizados</CardTitle>
            <CardDescription>
              {activePreset.label}. Ordena primero por severidad y luego por score para que la revisión ejecutiva no se disperse.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
            ) : filteredScores.length > 0 ? (
              filteredScores
                .slice()
                .sort((left, right) => {
                  const severityWeight = { warning: 0, secondary: 1, success: 2 };
                  return severityWeight[left.status] - severityWeight[right.status] || left.score - right.score;
                })
                .slice(0, 8)
                .map((territory) => (
                  <div key={territory.label} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{territory.label}</p>
                        <p className="mt-1">{territory.users} usuarios, {territory.games} partidas, {territory.turns} turnos.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={territory.status}>{territory.status}</Badge>
                        <Badge variant="outline">Score {territory.score}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {territory.reasons.map((reason) => (
                        <Badge key={reason} variant="outline">{reason}</Badge>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(buildDashboardHref(new URLSearchParams(searchParams.toString()), activePreset.key))}
                      >
                        Abrir en dashboard
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-5 text-sm text-muted-foreground">
                No hay focos territoriales para el preset activo con el recorte actual.
              </div>
            )}

            {summaryQuery.error ? (
              <div className="rounded-2xl border border-destructive/20 bg-white/85 p-4 text-sm text-destructive">
                No pude cargar las alertas territoriales: {getErrorMessage(summaryQuery.error)}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Resumen ejecutivo</CardTitle>
              <CardDescription>Lectura rápida para abrir conversación o seguimiento.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Territorios en warning</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{priorityCounters.critical}</p>
              </div>
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Señales intermedias</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{priorityCounters.secondary}</p>
              </div>
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Territorios sin turnos</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{priorityCounters.noTurns}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Alertas activas</CardTitle>
              <CardDescription>Mensajes del sistema territorial para priorización inmediata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summaryQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
              ) : filteredAlerts.length > 0 ? (
                filteredAlerts.slice(0, 6).map((alert) => (
                  <div key={`${alert.scope}-${alert.label}`} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{alert.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{alert.scope}</p>
                      </div>
                      <Badge variant={alert.severity}>{alert.severity}</Badge>
                    </div>
                    <p className="mt-2">{alert.message}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay alertas activas para este foco.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/12 p-3">
                  <MapPinned className="size-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Salto rápido al dashboard</p>
                  <p className="text-sm text-white/72">Abre la vista ejecutiva con el mismo recorte y el preset activo para seguir profundizando.</p>
                </div>
              </div>
              <Button type="button" variant="outline" className="mt-5 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => router.push(buildDashboardHref(new URLSearchParams(searchParams.toString()), activePreset.key))}>
                Ir al dashboard ejecutivo
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
