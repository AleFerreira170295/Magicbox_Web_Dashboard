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
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { getErrorMessage } from "@/lib/utils";

const EMPTY_LIST: never[] = [];

const territorialOverviewMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: string; description: string; range: string };
  scope: { active: string; clear: string; country: (v: string) => string; state: (v: string) => string; city: (v: string) => string; userType: (v: string) => string; role: (v: string) => string };
  summaries: { featuredTerritories: string; featuredInstitutions: string; topUsers: string; topTurns: string; territoriesHint: string; institutionsHint: string; usersHint: string; turnsHint: string };
  hierarchy: { title: string; description: string; usersInstitutionsGamesTurns: (users: number, institutions: number, games: number, turns: number) => string; focusCountry: string; focusState: string; noHierarchy: string };
  territories: { title: string; description: string; topBadge: string; noTerritories: string; institutionsUsersGamesTurns: (institutions: number, users: number, games: number, turns: number) => string };
  institutions: { title: string; description: string; noTerritorialDetail: string; users: (n: number) => string; games: (n: number) => string; turns: (n: number) => string; openDashboard: string; viewAlerts: string; noInstitutions: string; loadError: (m: string) => string };
  next: { title: string; description: string; alerts: string; dashboard: string };
}> = {
  es: {
    header: { eyebrow: "Gobierno", title: "Territorios e instituciones", description: "Pantalla para ubicar dónde están hoy las instituciones con más movimiento y cómo se distribuye el rendimiento territorial.", range: "Rango" },
    scope: { active: "Scope territorial activo", clear: "Limpiar filtros", country: (v) => `País · ${v}`, state: (v) => `Estado · ${v}`, city: (v) => `Ciudad · ${v}`, userType: (v) => `Tipo · ${v}`, role: (v) => `Rol · ${v}` },
    summaries: { featuredTerritories: "Territorios destacados", featuredInstitutions: "Instituciones destacadas", topUsers: "Usuarios en top instituciones", topTurns: "Turnos en top instituciones", territoriesHint: "Con actividad reciente para revisión ejecutiva.", institutionsHint: "Instituciones presentes en el top actual.", usersHint: "Aparecen como señal rápida de cobertura territorial.", turnsHint: "Sirve como lectura rápida de profundidad de uso." },
    hierarchy: { title: "Jerarquía territorial", description: "País → estado → ciudad para moverte rápido entre cortes sin salir de la pantalla.", usersInstitutionsGamesTurns: (u, i, g, t) => `${u} usuarios, ${i} instituciones, ${g} partidas, ${t} turnos.`, focusCountry: "Enfocar país", focusState: "Enfocar estado", noHierarchy: "No hay jerarquía territorial disponible para el recorte actual." },
    territories: { title: "Territorios destacados", description: "Los cortes con más movimiento para abrir seguimiento rápido.", topBadge: "Top territorial", noTerritories: "No hay territorios destacados para este recorte.", institutionsUsersGamesTurns: (i, u, g, t) => `${i} instituciones, ${u} usuarios, ${g} partidas, ${t} turnos.` },
    institutions: { title: "Instituciones destacadas", description: "Lectura de instituciones destacadas, con accesos rápidos a dashboard y alertas territoriales.", noTerritorialDetail: "Sin detalle territorial", users: (n) => `${n} usuarios`, games: (n) => `${n} partidas`, turns: (n) => `${n} turnos`, openDashboard: "Abrir dashboard", viewAlerts: "Ver alertas", noInstitutions: "No hay instituciones destacadas para el recorte actual.", loadError: (m) => `No pude cargar la vista territorial: ${m}` },
    next: { title: "Siguiente paso", description: "Desde aquí puedes seguir a alertas territoriales o abrir el dashboard ejecutivo ya recortado al mismo contexto.", alerts: "Alertas territoriales", dashboard: "Dashboard ejecutivo" },
  },
  en: {
    header: { eyebrow: "Government", title: "Territories and institutions", description: "Screen to locate where the institutions with the most movement are today and how territorial performance is distributed.", range: "Range" },
    scope: { active: "Active territorial scope", clear: "Clear filters", country: (v) => `Country · ${v}`, state: (v) => `State · ${v}`, city: (v) => `City · ${v}`, userType: (v) => `Type · ${v}`, role: (v) => `Role · ${v}` },
    summaries: { featuredTerritories: "Featured territories", featuredInstitutions: "Featured institutions", topUsers: "Users in top institutions", topTurns: "Turns in top institutions", territoriesHint: "With recent activity for executive review.", institutionsHint: "Institutions present in the current top list.", usersHint: "Shown as a quick territorial coverage signal.", turnsHint: "Useful as a quick read of depth of usage." },
    hierarchy: { title: "Territorial hierarchy", description: "Country → state → city so you can move quickly between slices without leaving the screen.", usersInstitutionsGamesTurns: (u, i, g, t) => `${u} users, ${i} institutions, ${g} games, ${t} turns.`, focusCountry: "Focus country", focusState: "Focus state", noHierarchy: "There is no territorial hierarchy available for the current slice." },
    territories: { title: "Featured territories", description: "The slices with the most movement so you can open follow-up quickly.", topBadge: "Top territory", noTerritories: "There are no featured territories for this slice.", institutionsUsersGamesTurns: (i, u, g, t) => `${i} institutions, ${u} users, ${g} games, ${t} turns.` },
    institutions: { title: "Featured institutions", description: "Reading of featured institutions, with quick access to dashboard and territorial alerts.", noTerritorialDetail: "No territorial detail", users: (n) => `${n} users`, games: (n) => `${n} games`, turns: (n) => `${n} turns`, openDashboard: "Open dashboard", viewAlerts: "View alerts", noInstitutions: "There are no featured institutions for the current slice.", loadError: (m) => `I couldn't load the territorial view: ${m}` },
    next: { title: "Next step", description: "From here you can continue to territorial alerts or open the executive dashboard already narrowed to the same context.", alerts: "Territorial alerts", dashboard: "Executive dashboard" },
  },
  pt: {
    header: { eyebrow: "Governo", title: "Territórios e instituições", description: "Tela para localizar onde estão hoje as instituições com mais movimento e como o desempenho territorial se distribui.", range: "Período" },
    scope: { active: "Escopo territorial ativo", clear: "Limpar filtros", country: (v) => `País · ${v}`, state: (v) => `Estado · ${v}`, city: (v) => `Cidade · ${v}`, userType: (v) => `Tipo · ${v}`, role: (v) => `Papel · ${v}` },
    summaries: { featuredTerritories: "Territórios destacados", featuredInstitutions: "Instituições destacadas", topUsers: "Usuários nas top instituições", topTurns: "Turnos nas top instituições", territoriesHint: "Com atividade recente para revisão executiva.", institutionsHint: "Instituições presentes no topo atual.", usersHint: "Aparecem como sinal rápido de cobertura territorial.", turnsHint: "Serve como leitura rápida da profundidade de uso." },
    hierarchy: { title: "Hierarquia territorial", description: "País → estado → cidade para se mover rápido entre recortes sem sair da tela.", usersInstitutionsGamesTurns: (u, i, g, t) => `${u} usuários, ${i} instituições, ${g} partidas, ${t} turnos.`, focusCountry: "Focar país", focusState: "Focar estado", noHierarchy: "Não há hierarquia territorial disponível para o recorte atual." },
    territories: { title: "Territórios destacados", description: "Os recortes com mais movimento para abrir acompanhamento rápido.", topBadge: "Top territorial", noTerritories: "Não há territórios destacados para este recorte.", institutionsUsersGamesTurns: (i, u, g, t) => `${i} instituições, ${u} usuários, ${g} partidas, ${t} turnos.` },
    institutions: { title: "Instituições destacadas", description: "Leitura de instituições destacadas, com acessos rápidos ao dashboard e alertas territoriais.", noTerritorialDetail: "Sem detalhe territorial", users: (n) => `${n} usuários`, games: (n) => `${n} partidas`, turns: (n) => `${n} turnos`, openDashboard: "Abrir dashboard", viewAlerts: "Ver alertas", noInstitutions: "Não há instituições destacadas para o recorte atual.", loadError: (m) => `Não consegui carregar a visão territorial: ${m}` },
    next: { title: "Próximo passo", description: "Daqui você pode seguir para alertas territoriais ou abrir o dashboard executivo já recortado para o mesmo contexto.", alerts: "Alertas territoriais", dashboard: "Dashboard executivo" },
  },
};

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
  const { language } = useLanguage();
  const t = territorialOverviewMessages[language];
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
      selectedCountryCode ? t.scope.country(selectedCountryCode) : null,
      selectedState ? t.scope.state(selectedState) : null,
      selectedCity ? t.scope.city(selectedCity) : null,
      selectedUserType ? t.scope.userType(selectedUserType) : null,
      selectedRoleCode ? t.scope.role(selectedRoleCode) : null,
    ].filter((value): value is string => Boolean(value)),
    [selectedCity, selectedCountryCode, selectedRoleCode, selectedState, selectedUserType, t],
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
        eyebrow={t.header.eyebrow}
        title={t.header.title}
        description={t.header.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t.header.range}</span>
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
              <p className="text-sm font-medium text-foreground">{t.scope.active}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scopeTags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clearTerritorialScope}>
              {t.scope.clear}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.summaries.featuredTerritories}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topTerritories.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.summaries.territoriesHint}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.summaries.featuredInstitutions}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topInstitutions.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.summaries.institutionsHint}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.summaries.topUsers}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topInstitutions.reduce((sum, item) => sum + item.users, 0)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.summaries.usersHint}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.summaries.topTurns}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{topInstitutions.reduce((sum, item) => sum + item.turns, 0)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.summaries.turnsHint}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.hierarchy.title}</CardTitle>
            <CardDescription>{t.hierarchy.description}</CardDescription>
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
                      <p className="mt-1">{t.hierarchy.usersInstitutionsGamesTurns(country.users, country.institutions, country.games, country.turns)}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => updateQuery({ country_code: country.key, state: "", city: "" })}>
                      {t.hierarchy.focusCountry}
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3 border-l border-border/60 pl-4">
                    {country.states.slice(0, 4).map((stateEntry) => (
                      <div key={`${country.key}-${stateEntry.key}`} className="rounded-xl bg-background/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{stateEntry.key}</p>
                            <p className="mt-1">{t.hierarchy.usersInstitutionsGamesTurns(stateEntry.users, stateEntry.institutions, stateEntry.games, stateEntry.turns)}</p>
                          </div>
                          <Button type="button" variant="secondary" size="sm" onClick={() => updateQuery({ country_code: country.key, state: stateEntry.key, city: "" })}>
                            {t.hierarchy.focusState}
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
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.hierarchy.noHierarchy}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.territories.title}</CardTitle>
            <CardDescription>{t.territories.description}</CardDescription>
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
                      <p className="mt-1">{t.territories.institutionsUsersGamesTurns(territory.institutions, territory.users, territory.games, territory.turns)}</p>
                    </div>
                    <Badge variant="outline">{t.territories.topBadge}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.territories.noTerritories}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>{t.institutions.title}</CardTitle>
          <CardDescription>{t.institutions.description}</CardDescription>
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
                    <p className="mt-1">{[institution.state, institution.city].filter(Boolean).join(" / ") || t.institutions.noTerritorialDetail}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{t.institutions.users(institution.users)}</Badge>
                    <Badge variant="outline">{t.institutions.games(institution.games)}</Badge>
                    <Badge variant="outline">{t.institutions.turns(institution.turns)}</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(buildHref("/dashboard", new URLSearchParams(searchParams.toString()), { state: institution.state || "", city: institution.city || "" }))}
                  >
                    {t.institutions.openDashboard}
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(buildHref("/territorial-alerts", new URLSearchParams(searchParams.toString()), { state: institution.state || "", city: institution.city || "" }))}
                  >
                    {t.institutions.viewAlerts}
                    <Radar className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.institutions.noInstitutions}</div>
          )}

          {summaryQuery.error ? (
            <div className="rounded-2xl border border-destructive/20 bg-white/85 p-4 text-sm text-destructive">
              {t.institutions.loadError(getErrorMessage(summaryQuery.error))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-lg font-semibold">{t.next.title}</p>
            <p className="mt-2 text-sm text-white/72">{t.next.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => router.push(buildHref("/territorial-alerts", new URLSearchParams(searchParams.toString())))}>
              {t.next.alerts}
              <Rows3 className="size-4" />
            </Button>
            <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => router.push(buildHref("/dashboard", new URLSearchParams(searchParams.toString())))}>
              {t.next.dashboard}
              <MapPinned className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
