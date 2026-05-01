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
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { getErrorMessage } from "@/lib/utils";

type FocusPresetKey = "critical" | "score_lt_60" | "no_turns" | "high_population_low_activity";
const EMPTY_LIST: never[] = [];

const territorialAlertsMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: string; description: string; range: string };
  presets: { critical: string; criticalDesc: string; scoreLow: string; scoreLowDesc: string; noTurns: string; noTurnsDesc: string; highPopulation: string; highPopulationDesc: string };
  cards: { prioritized: string; prioritizedDesc: (label: string) => string; usersGamesTurns: (users: number, games: number, turns: number) => string; openDashboard: string; noFocus: string; loadError: (message: string) => string; executiveSummary: string; executiveSummaryDesc: string; warningTerritories: string; midSignals: string; noTurnsTerritories: string; activeAlerts: string; activeAlertsDesc: string; noActiveAlerts: string; quickJump: string; quickJumpDesc: string; goToExecutive: string; score: (value: number) => string };
}> = {
  es: {
    header: { eyebrow: "Gobierno", title: "Alertas territoriales", description: "Pantalla ejecutiva para detectar territorios con foco inmediato, ordenar prioridades y saltar al dashboard ya filtrado.", range: "Rango" },
    presets: { critical: "Territorios críticos", criticalDesc: "Alertas activas o score en warning.", scoreLow: "Score < 60", scoreLowDesc: "Territorios con señal compuesta débil.", noTurns: "Sin turnos", noTurnsDesc: "Usuarios visibles pero sin actividad de turnos.", highPopulation: "Alta población, baja actividad", highPopulationDesc: "Muchos usuarios con muy poco movimiento." },
    cards: { prioritized: "Focos priorizados", prioritizedDesc: (label) => `${label}. Ordena primero por severidad y luego por score para que la revisión ejecutiva no se disperse.`, usersGamesTurns: (users, games, turns) => `${users} usuarios, ${games} partidas, ${turns} turnos.`, openDashboard: "Abrir en dashboard", noFocus: "No hay focos territoriales para el preset activo con el recorte actual.", loadError: (message) => `No pude cargar las alertas territoriales: ${message}`, executiveSummary: "Resumen ejecutivo", executiveSummaryDesc: "Lectura rápida para abrir conversación o seguimiento.", warningTerritories: "Territorios en warning", midSignals: "Señales intermedias", noTurnsTerritories: "Territorios sin turnos", activeAlerts: "Alertas activas", activeAlertsDesc: "Mensajes del sistema territorial para priorización inmediata.", noActiveAlerts: "No hay alertas activas para este foco.", quickJump: "Salto rápido al dashboard", quickJumpDesc: "Abre la vista ejecutiva con el mismo recorte y el preset activo para seguir profundizando.", goToExecutive: "Ir al dashboard ejecutivo", score: (value) => `Score ${value}` },
  },
  en: {
    header: { eyebrow: "Government", title: "Territorial alerts", description: "Executive screen to detect territories needing immediate focus, order priorities, and jump into the already-filtered dashboard.", range: "Range" },
    presets: { critical: "Critical territories", criticalDesc: "Active alerts or warning score.", scoreLow: "Score < 60", scoreLowDesc: "Territories with weak composite signal.", noTurns: "No turns", noTurnsDesc: "Visible users but no turn activity.", highPopulation: "High population, low activity", highPopulationDesc: "Many users with very little movement." },
    cards: { prioritized: "Prioritized focus", prioritizedDesc: (label) => `${label}. Sorted first by severity and then by score so executive review stays focused.`, usersGamesTurns: (users, games, turns) => `${users} users, ${games} games, ${turns} turns.`, openDashboard: "Open in dashboard", noFocus: "There are no territorial focus areas for the active preset with the current slice.", loadError: (message) => `I couldn't load territorial alerts: ${message}`, executiveSummary: "Executive summary", executiveSummaryDesc: "Quick read to start conversation or follow-up.", warningTerritories: "Warning territories", midSignals: "Intermediate signals", noTurnsTerritories: "Territories without turns", activeAlerts: "Active alerts", activeAlertsDesc: "Messages from the territorial system for immediate prioritization.", noActiveAlerts: "There are no active alerts for this focus.", quickJump: "Quick jump to dashboard", quickJumpDesc: "Opens the executive view with the same slice and active preset so you can dig deeper.", goToExecutive: "Go to executive dashboard", score: (value) => `Score ${value}` },
  },
  pt: {
    header: { eyebrow: "Governo", title: "Alertas territoriais", description: "Tela executiva para detectar territórios com foco imediato, ordenar prioridades e saltar para o dashboard já filtrado.", range: "Período" },
    presets: { critical: "Territórios críticos", criticalDesc: "Alertas ativos ou score em warning.", scoreLow: "Score < 60", scoreLowDesc: "Territórios com sinal composto fraco.", noTurns: "Sem turnos", noTurnsDesc: "Usuários visíveis mas sem atividade de turnos.", highPopulation: "Alta população, baixa atividade", highPopulationDesc: "Muitos usuários com pouquíssimo movimento." },
    cards: { prioritized: "Focos priorizados", prioritizedDesc: (label) => `${label}. Ordena primeiro por severidade e depois por score para que a revisão executiva não se disperse.`, usersGamesTurns: (users, games, turns) => `${users} usuários, ${games} partidas, ${turns} turnos.`, openDashboard: "Abrir no dashboard", noFocus: "Não há focos territoriais para o preset ativo com o recorte atual.", loadError: (message) => `Não consegui carregar os alertas territoriais: ${message}`, executiveSummary: "Resumo executivo", executiveSummaryDesc: "Leitura rápida para abrir conversa ou acompanhamento.", warningTerritories: "Territórios em warning", midSignals: "Sinais intermediários", noTurnsTerritories: "Territórios sem turnos", activeAlerts: "Alertas ativos", activeAlertsDesc: "Mensagens do sistema territorial para priorização imediata.", noActiveAlerts: "Não há alertas ativos para este foco.", quickJump: "Salto rápido para o dashboard", quickJumpDesc: "Abre a visão executiva com o mesmo recorte e o preset ativo para seguir aprofundando.", goToExecutive: "Ir para o dashboard executivo", score: (value) => `Score ${value}` },
  },
};

function buildDashboardHref(searchParams: URLSearchParams, preset?: FocusPresetKey | "") {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("focus");
  if (preset) {
    params.set("smart_preset", preset);
  }
  return `/dashboard?${params.toString()}`;
}

export function TerritorialAlertsCenter() {
  const { language } = useLanguage();
  const t = territorialAlertsMessages[language];
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
        label: t.presets.critical,
        description: t.presets.criticalDesc,
        count: territoryScores.filter((item) => item.status === "warning" || territoryAlerts.some((alert) => alert.label.includes(item.label))).length,
      },
      {
        key: "score_lt_60" as const,
        label: t.presets.scoreLow,
        description: t.presets.scoreLowDesc,
        count: territoryScores.filter((item) => item.score < 60).length,
      },
      {
        key: "no_turns" as const,
        label: t.presets.noTurns,
        description: t.presets.noTurnsDesc,
        count: territoryScores.filter((item) => item.users > 0 && item.turns === 0).length,
      },
      {
        key: "high_population_low_activity" as const,
        label: t.presets.highPopulation,
        description: t.presets.highPopulationDesc,
        count: territoryScores.filter((item) => item.users >= 10 && item.turns / Math.max(item.users, 1) < 0.25).length,
      },
    ],
    [t, territoryAlerts, territoryScores],
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

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
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

      <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.cards.prioritized}</CardTitle>
            <CardDescription>
              {t.cards.prioritizedDesc(activePreset.label)}
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
                        <p className="mt-1">{t.cards.usersGamesTurns(territory.users, territory.games, territory.turns)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={territory.status}>{territory.status}</Badge>
                        <Badge variant="outline">{t.cards.score(territory.score)}</Badge>
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
                        {t.cards.openDashboard}
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl bg-white/80 p-5 text-sm text-muted-foreground">
                {t.cards.noFocus}
              </div>
            )}

            {summaryQuery.error ? (
              <div className="rounded-2xl border border-destructive/20 bg-white/85 p-4 text-sm text-destructive">
                {t.cards.loadError(getErrorMessage(summaryQuery.error))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>{t.cards.executiveSummary}</CardTitle>
              <CardDescription>{t.cards.executiveSummaryDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">{t.cards.warningTerritories}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{priorityCounters.critical}</p>
              </div>
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">{t.cards.midSignals}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{priorityCounters.secondary}</p>
              </div>
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">{t.cards.noTurnsTerritories}</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{priorityCounters.noTurns}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>{t.cards.activeAlerts}</CardTitle>
              <CardDescription>{t.cards.activeAlertsDesc}</CardDescription>
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
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.cards.noActiveAlerts}</div>
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
                  <p className="text-lg font-semibold">{t.cards.quickJump}</p>
                  <p className="text-sm text-white/72">{t.cards.quickJumpDesc}</p>
                </div>
              </div>
              <Button type="button" variant="outline" className="mt-5 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => router.push(buildDashboardHref(new URLSearchParams(searchParams.toString()), activePreset.key))}>
                {t.cards.goToExecutive}
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
