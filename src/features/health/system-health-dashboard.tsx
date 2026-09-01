"use client";

import { type ComponentType, type ReactNode, useMemo } from "react";
import { Activity, AlertTriangle, HeartPulse, Layers3, ShieldCheck, Smartphone } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useBasicHealth, useLivenessHealth, useReadinessHealth } from "@/features/health/api";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

const healthMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: string; description: string };
  cards: { devicesWithoutStatus: string; syncsWithRaw: string };
  error: (message: string) => string;
  checks: { title: string; description: string; empty: string; noMessage: string; unknown: string };
  priorities: {
    title: string;
    description: string;
    dataQuality: (devicesWithoutStatus: number, unknownSourceSyncs: number, profilesWithoutBindings: number) => ReactNode;
    successRate: (successRate: number, totalTurns: number) => ReactNode;
    backendResponse: (timestamp: string) => ReactNode;
  };
  devices: { title: string; description: string; name: string; scope: string; status: string; firmware: string; updated: string; empty: string; noStatus: string };
  syncs: { title: string; description: string; origin: string; device: string; synced: string; empty: string; unknown: string; available: string; pending: string };
}> = {
  es: {
    header: { eyebrow: "Salud global", title: "Salud del sistema", description: "Combina el health técnico real del backend con señales operativas globales para detectar rápido qué conviene revisar primero." },
    cards: { devicesWithoutStatus: "Dispositivos sin estado", syncsWithRaw: "Syncs con raw" },
    error: (message) => `No pude cargar una parte de la salud operativa: ${message}`,
    checks: { title: "Checks técnicos", description: "Estado real de readiness para base de datos, configuración y dependencias externas.", empty: "No hay checks técnicos para mostrar.", noMessage: "Sin mensaje", unknown: "unknown" },
    priorities: {
      title: "Qué mirar primero",
      description: "Resumen corto para arrancar por riesgo y no por intuición.",
      dataQuality: (devicesWithoutStatus, unknownSourceSyncs, profilesWithoutBindings) => <>Hay <strong>{devicesWithoutStatus}</strong> dispositivos sin estado, <strong>{unknownSourceSyncs}</strong> syncs sin origen claro y <strong>{profilesWithoutBindings}</strong> profiles sin bindings activos.</>,
      successRate: (successRate, totalTurns) => <>La tasa agregada de éxito en turnos visibles es <strong>{successRate}%</strong> sobre <strong>{totalTurns}</strong> turnos persistidos.</>,
      backendResponse: (timestamp) => <>Última respuesta básica del backend: <strong>{timestamp}</strong>.</>,
    },
    devices: { title: "Dispositivos recientes", description: "Últimos dispositivos visibles para una revisión rápida de metadata y estado.", name: "Nombre", scope: "Scope", status: "Estado", firmware: "Firmware", updated: "Actualizado", empty: "No hay dispositivos para mostrar.", noStatus: "sin estado" },
    syncs: { title: "Syncs recientes", description: "Trazabilidad rápida sobre sesiones sincronizadas visibles en el dashboard.", origin: "Origen", device: "Dispositivo", synced: "Sincronizado", empty: "No hay sincronizaciones para mostrar.", unknown: "desconocido", available: "disponible", pending: "pendiente" },
  },
  en: {
    header: { eyebrow: "Global health", title: "System health", description: "Combines real backend technical health with global operational signals to quickly identify what should be reviewed first." },
    cards: { devicesWithoutStatus: "Devices without status", syncsWithRaw: "Syncs with raw" },
    error: (message) => `I couldn't load part of operational health: ${message}`,
    checks: { title: "Technical checks", description: "Real readiness state for database, configuration, and external dependencies.", empty: "There are no technical checks to show.", noMessage: "No message", unknown: "unknown" },
    priorities: {
      title: "What to review first",
      description: "Short risk-first summary for starting with evidence instead of intuition.",
      dataQuality: (devicesWithoutStatus, unknownSourceSyncs, profilesWithoutBindings) => <>There are <strong>{devicesWithoutStatus}</strong> devices without status, <strong>{unknownSourceSyncs}</strong> syncs without a clear source, and <strong>{profilesWithoutBindings}</strong> profiles without active bindings.</>,
      successRate: (successRate, totalTurns) => <>The aggregate success rate for visible turns is <strong>{successRate}%</strong> across <strong>{totalTurns}</strong> persisted turns.</>,
      backendResponse: (timestamp) => <>Latest basic backend response: <strong>{timestamp}</strong>.</>,
    },
    devices: { title: "Recent devices", description: "Latest visible devices for a quick metadata and status review.", name: "Name", scope: "Scope", status: "Status", firmware: "Firmware", updated: "Updated", empty: "There are no devices to show.", noStatus: "no status" },
    syncs: { title: "Recent syncs", description: "Quick traceability for synchronized sessions visible in the dashboard.", origin: "Source", device: "Device", synced: "Synced", empty: "There are no syncs to show.", unknown: "unknown", available: "available", pending: "pending" },
  },
  pt: {
    header: { eyebrow: "Saúde global", title: "Saúde do sistema", description: "Combina o health técnico real do backend com sinais operacionais globais para detectar rapidamente o que convém revisar primeiro." },
    cards: { devicesWithoutStatus: "Dispositivos sem estado", syncsWithRaw: "Syncs com raw" },
    error: (message) => `Não consegui carregar parte da saúde operacional: ${message}`,
    checks: { title: "Checks técnicos", description: "Estado real de readiness para banco de dados, configuração e dependências externas.", empty: "Não há checks técnicos para mostrar.", noMessage: "Sem mensagem", unknown: "unknown" },
    priorities: {
      title: "O que olhar primeiro",
      description: "Resumo curto para começar pelo risco e não pela intuição.",
      dataQuality: (devicesWithoutStatus, unknownSourceSyncs, profilesWithoutBindings) => <>Há <strong>{devicesWithoutStatus}</strong> dispositivos sem estado, <strong>{unknownSourceSyncs}</strong> syncs sem origem clara e <strong>{profilesWithoutBindings}</strong> profiles sem bindings ativos.</>,
      successRate: (successRate, totalTurns) => <>A taxa agregada de sucesso em turnos visíveis é <strong>{successRate}%</strong> sobre <strong>{totalTurns}</strong> turnos persistidos.</>,
      backendResponse: (timestamp) => <>Última resposta básica do backend: <strong>{timestamp}</strong>.</>,
    },
    devices: { title: "Dispositivos recentes", description: "Últimos dispositivos visíveis para uma revisão rápida de metadata e estado.", name: "Nome", scope: "Scope", status: "Estado", firmware: "Firmware", updated: "Atualizado", empty: "Não há dispositivos para mostrar.", noStatus: "sem estado" },
    syncs: { title: "Syncs recentes", description: "Rastreabilidade rápida das sessões sincronizadas visíveis no dashboard.", origin: "Origem", device: "Dispositivo", synced: "Sincronizado", empty: "Não há sincronizações para mostrar.", unknown: "desconhecido", available: "disponível", pending: "pendente" },
  },
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "warning" | "accent";
}) {
  const toneClass = {
    primary: "bg-primary/12 text-primary",
    warning: "bg-amber-100 text-amber-700",
    accent: "bg-accent text-accent-foreground",
  }[tone];

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
          </div>
          <div className={`rounded-2xl p-3 ${toneClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemHealthDashboard() {
  const { tokens } = useAuth();
  const { language } = useLanguage();
  const t = healthMessages[language];
  const basicHealthQuery = useBasicHealth();
  const readinessQuery = useReadinessHealth();
  const livenessQuery = useLivenessHealth();
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const profilesQuery = useProfilesOverview(tokens?.accessToken);

  const isLoading =
    basicHealthQuery.isLoading ||
    readinessQuery.isLoading ||
    livenessQuery.isLoading ||
    devicesQuery.isLoading ||
    syncsQuery.isLoading ||
    gamesQuery.isLoading ||
    profilesQuery.isLoading;

  const error =
    readinessQuery.error ||
    basicHealthQuery.error ||
    livenessQuery.error ||
    devicesQuery.error ||
    syncsQuery.error ||
    gamesQuery.error ||
    profilesQuery.error;

  const metrics = useMemo(() => {
    const devices = devicesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];
    const games = gamesQuery.data?.data || [];
    const profiles = profilesQuery.data || [];

    const readinessChecks = readinessQuery.data?.checks || {};
    const readinessFailures = Object.values(readinessChecks).filter((check) => check?.status !== "healthy").length;
    const devicesWithoutStatus = devices.filter((device) => !device.status).length;
    const homeDevices = devices.filter((device) => device.assignmentScope === "home").length;
    const rawAvailableSyncs = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0).length;
    const unknownSourceSyncs = syncs.filter((sync) => !(sync.source || sync.sourceType)).length;
    const totalTurns = games.reduce((acc, game) => acc + game.turns.length, 0);
    const successfulTurns = games.reduce((acc, game) => acc + game.turns.filter((turn) => turn.success).length, 0);
    const profilesWithoutBindings = profiles.filter((profile) => profile.activeBindingCount === 0).length;

    return {
      appStatus: basicHealthQuery.data?.status || "unknown",
      readinessStatus: readinessQuery.data?.status || "unknown",
      uptime: livenessQuery.data?.uptime || "-",
      readinessFailures,
      totalDevices: devicesQuery.data?.total || devices.length,
      devicesWithoutStatus,
      homeDevices,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      rawAvailableSyncs,
      unknownSourceSyncs,
      totalGames: gamesQuery.data?.total || games.length,
      totalTurns,
      successRate: totalTurns > 0 ? Math.round((successfulTurns / totalTurns) * 100) : 0,
      totalProfiles: profiles.length,
      profilesWithoutBindings,
      readinessChecks,
      recentDevices: devices,
      recentSyncs: syncs,
    };
  }, [basicHealthQuery.data, devicesQuery.data, gamesQuery.data, livenessQuery.data, profilesQuery.data, readinessQuery.data, syncsQuery.data]);

  const recentDevicesPagination = useListPagination(metrics.recentDevices);
  const recentSyncsPagination = useListPagination(metrics.recentSyncs);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title}
        description={t.header.description}
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="App" value={metrics.appStatus} icon={HeartPulse} tone={metrics.appStatus === "healthy" ? "primary" : "warning"} />
            <SummaryCard label="Readiness" value={metrics.readinessStatus} icon={ShieldCheck} tone={metrics.readinessFailures === 0 ? "accent" : "warning"} />
            <SummaryCard label="Uptime" value={metrics.uptime} icon={Activity} />
            <SummaryCard label={t.cards.devicesWithoutStatus} value={String(metrics.devicesWithoutStatus)} icon={Smartphone} tone={metrics.devicesWithoutStatus === 0 ? "accent" : "warning"} />
            <SummaryCard label={t.cards.syncsWithRaw} value={`${metrics.rawAvailableSyncs}/${metrics.totalSyncs}`} icon={Layers3} tone="accent" />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            {t.error(getErrorMessage(error))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.checks.title}</CardTitle>
            <CardDescription>{t.checks.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {Object.entries(metrics.readinessChecks).length === 0 ? (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">{t.checks.empty}</div>
            ) : (
              Object.entries(metrics.readinessChecks).map(([key, check]) => (
                <div key={key} className="rounded-2xl bg-white/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <Badge variant={check?.status === "healthy" ? "success" : "outline"}>{check?.status || t.checks.unknown}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{check?.message || t.checks.noMessage}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-primary" />
            <CardTitle>{t.priorities.title}</CardTitle>
            </div>
            <CardDescription>{t.priorities.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              {t.priorities.dataQuality(metrics.devicesWithoutStatus, metrics.unknownSourceSyncs, metrics.profilesWithoutBindings)}
            </div>
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              {t.priorities.successRate(metrics.successRate, metrics.totalTurns)}
            </div>
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              {t.priorities.backendResponse(formatDateTime(basicHealthQuery.data?.timestamp))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>{t.devices.title}</CardTitle>
                <CardDescription>{t.devices.description}</CardDescription>
              </div>
              <ListPaginationControls
                pageSize={recentDevicesPagination.pageSize}
                setPageSize={recentDevicesPagination.setPageSize}
                currentPage={recentDevicesPagination.currentPage}
                totalPages={recentDevicesPagination.totalPages}
                totalItems={recentDevicesPagination.totalItems}
                paginationStart={recentDevicesPagination.paginationStart}
                paginationEnd={recentDevicesPagination.paginationEnd}
                goToPreviousPage={recentDevicesPagination.goToPreviousPage}
                goToNextPage={recentDevicesPagination.goToNextPage}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.devices.name}</TableHead>
                    <TableHead>{t.devices.scope}</TableHead>
                    <TableHead>{t.devices.status}</TableHead>
                    <TableHead>{t.devices.firmware}</TableHead>
                    <TableHead>{t.devices.updated}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.recentDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {t.devices.empty}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentDevicesPagination.paginatedItems.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell>
                          <Badge variant={device.assignmentScope === "home" ? "secondary" : "outline"}>{device.assignmentScope || "institution"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.status ? "success" : "outline"}>{device.status || t.devices.noStatus}</Badge>
                        </TableCell>
                        <TableCell>{device.firmwareVersion || "-"}</TableCell>
                        <TableCell>{formatDateTime(device.updatedAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>{t.syncs.title}</CardTitle>
                <CardDescription>{t.syncs.description}</CardDescription>
              </div>
              <ListPaginationControls
                pageSize={recentSyncsPagination.pageSize}
                setPageSize={recentSyncsPagination.setPageSize}
                currentPage={recentSyncsPagination.currentPage}
                totalPages={recentSyncsPagination.totalPages}
                totalItems={recentSyncsPagination.totalItems}
                paginationStart={recentSyncsPagination.paginationStart}
                paginationEnd={recentSyncsPagination.paginationEnd}
                goToPreviousPage={recentSyncsPagination.goToPreviousPage}
                goToNextPage={recentSyncsPagination.goToNextPage}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sync ID</TableHead>
                    <TableHead>{t.syncs.origin}</TableHead>
                    <TableHead>{t.syncs.device}</TableHead>
                    <TableHead>Raw</TableHead>
                    <TableHead>{t.syncs.synced}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.recentSyncs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {t.syncs.empty}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentSyncsPagination.paginatedItems.map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell className="max-w-52 truncate font-mono text-xs">{sync.syncId || sync.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sync.source || sync.sourceType || t.syncs.unknown}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{sync.deviceId || sync.bleDeviceId || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={(sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 ? "success" : "outline"}>
                            {(sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 ? t.syncs.available : t.syncs.pending}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(sync.syncedAt || sync.receivedAt || sync.startedAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
