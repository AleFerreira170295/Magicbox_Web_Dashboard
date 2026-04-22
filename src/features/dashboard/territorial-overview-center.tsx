"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, MapPinned, Radar, Rows3 } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useSystemDashboardSummary } from "@/features/dashboard/api";
import { getErrorMessage } from "@/lib/utils";

const EMPTY_LIST: never[] = [];

function buildHref(basePath: string, searchParams: URLSearchParams, extraEntries?: Record<string, string>) {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("focus");
  params.delete("smart_preset");

  for (const [key, value] of Object.entries(extraEntries || {})) {
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  return `${basePath}?${params.toString()}`;
}

export function TerritorialOverviewCenter() {
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

  const summaryQuery = useSystemDashboardSummary(
    tokens?.accessToken,
    {
      range: selectedRange,
      countryCode: selectedCountryCode,
      state: selectedState,
      city: selectedCity,
      userType: selectedUserType,
      roleCode: selectedRoleCode,
    },
    true,
  );

  const rangeOptions = summaryQuery.data?.filters.range_options ?? EMPTY_LIST;
  const topInstitutions = summaryQuery.data?.segments.top_institutions ?? EMPTY_LIST;
  const topTerritories = summaryQuery.data?.segments.top_territories ?? EMPTY_LIST;
  const territorialHierarchy = summaryQuery.data?.segments.territorial_hierarchy ?? EMPTY_LIST;

  const scopeTags = useMemo(
    () => [
      selectedCountryCode ? `País · ${selectedCountryCode}` : null,
      selectedState ? `Estado · ${selectedState}` : null,
      selectedCity ? `Ciudad · ${selectedCity}` : null,
      selectedUserType ? `Tipo · ${selectedUserType}` : null,
      selectedRoleCode ? `Rol · ${selectedRoleCode}` : null,
    ].filter((value): value is string => Boolean(value)),
    [selectedCity, selectedCountryCode, selectedRoleCode, selectedState, selectedUserType],
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

  function clearTerritorialScope() {
    updateQuery({
      country_code: "",
      state: "",
      city: "",
    });
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Gobierno"
        title="Territorios e instituciones"
        description="Pantalla operativa para ubicar dónde están hoy las instituciones con más movimiento y cómo se distribuye el rendimiento territorial."
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

      {scopeTags.length > 0 ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-foreground">Scope territorial activo</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scopeTags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clearTerritorialScope}>
              Limpiar scope
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Territorios destacados</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topTerritories.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Con actividad visible para revisión ejecutiva.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Instituciones destacadas</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topInstitutions.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Instituciones visibles en el top operativo actual.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Usuarios en top instituciones</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topInstitutions.reduce((sum, item) => sum + item.users, 0)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Aparecen como señal rápida de cobertura visible.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Turnos en top instituciones</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topInstitutions.reduce((sum, item) => sum + item.turns, 0)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Sirve como lectura rápida de profundidad de uso.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Jerarquía territorial</CardTitle>
            <CardDescription>País → estado → ciudad para moverte rápido entre cortes sin salir de la pantalla.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summaryQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
            ) : territorialHierarchy.length > 0 ? (
              territorialHierarchy.map((country) => (
                <div key={country.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{country.key}</p>
                      <p className="mt-1">{country.users} usuarios, {country.institutions} instituciones, {country.games} partidas, {country.turns} turnos.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => updateQuery({ country_code: country.key, state: "", city: "" })}>
                      Enfocar país
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3 border-l border-border/60 pl-4">
                    {country.states.slice(0, 4).map((stateEntry) => (
                      <div key={`${country.key}-${stateEntry.key}`} className="rounded-xl bg-background/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{stateEntry.key}</p>
                            <p className="mt-1">{stateEntry.users} usuarios, {stateEntry.institutions} instituciones, {stateEntry.games} partidas, {stateEntry.turns} turnos.</p>
                          </div>
                          <Button type="button" variant="secondary" size="sm" onClick={() => updateQuery({ country_code: country.key, state: stateEntry.key, city: "" })}>
                            Enfocar estado
                          </Button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {stateEntry.cities.slice(0, 4).map((cityEntry) => (
                            <Button
                              key={`${country.key}-${stateEntry.key}-${cityEntry.key}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuery({ country_code: country.key, state: stateEntry.key, city: cityEntry.key })}
                            >
                              {cityEntry.key}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay jerarquía territorial visible con el recorte actual.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Territorios destacados</CardTitle>
            <CardDescription>Los cortes con más movimiento visible para abrir seguimiento rápido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
            ) : topTerritories.length > 0 ? (
              topTerritories.map((territory) => (
                <div key={territory.key} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{territory.key}</p>
                      <p className="mt-1">{territory.institutions} instituciones, {territory.users} usuarios, {territory.games} partidas, {territory.turns} turnos.</p>
                    </div>
                    <Badge variant="outline">Top territorial</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay territorios destacados para este recorte.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Instituciones destacadas</CardTitle>
          <CardDescription>Lectura operativa de instituciones visibles, con accesos rápidos a dashboard y alertas territoriales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaryQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
          ) : topInstitutions.length > 0 ? (
            topInstitutions.map((institution) => (
              <div key={institution.id} className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{institution.name}</p>
                    <p className="mt-1">{[institution.state, institution.city].filter(Boolean).join(" / ") || "Sin detalle territorial"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{institution.users} usuarios</Badge>
                    <Badge variant="outline">{institution.games} partidas</Badge>
                    <Badge variant="outline">{institution.turns} turnos</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(buildHref("/dashboard", new URLSearchParams(searchParams.toString()), { state: institution.state || "", city: institution.city || "" }))}
                  >
                    Abrir dashboard
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(buildHref("/territorial-alerts", new URLSearchParams(searchParams.toString()), { state: institution.state || "", city: institution.city || "" }))}
                  >
                    Ver alertas
                    <Radar className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay instituciones destacadas visibles con el recorte actual.</div>
          )}

          {summaryQuery.error ? (
            <div className="rounded-2xl border border-destructive/20 bg-white/85 p-4 text-sm text-destructive">
              No pude cargar la vista territorial: {getErrorMessage(summaryQuery.error)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-lg font-semibold">Siguiente salto operativo</p>
            <p className="mt-2 text-sm text-white/72">Desde aquí puedes seguir a alertas territoriales o abrir el dashboard ejecutivo ya recortado al mismo contexto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => router.push(buildHref("/territorial-alerts", new URLSearchParams(searchParams.toString())))}>
              Alertas territoriales
              <Rows3 className="size-4" />
            </Button>
            <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => router.push(buildHref("/dashboard", new URLSearchParams(searchParams.toString())))}>
              Dashboard ejecutivo
              <MapPinned className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
