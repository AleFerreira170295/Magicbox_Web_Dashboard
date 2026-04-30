"use client";

import { type ComponentType, useMemo } from "react";
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
import { useProfilesOverview } from "@/features/profiles/api";
import { useSyncSessions } from "@/features/syncs/api";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint: string;
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
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
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
        eyebrow="Salud global"
        title="Salud del sistema"
        description="Combina el health técnico real del backend con señales operativas globales para detectar rápido qué conviene revisar primero."
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="App" value={metrics.appStatus} hint="Estado básico publicado por el backend." icon={HeartPulse} tone={metrics.appStatus === "healthy" ? "primary" : "warning"} />
            <SummaryCard label="Readiness" value={metrics.readinessStatus} hint={`Checks degradados: ${metrics.readinessFailures}.`} icon={ShieldCheck} tone={metrics.readinessFailures === 0 ? "accent" : "warning"} />
            <SummaryCard label="Uptime" value={metrics.uptime} hint="Tiempo de vida reportado por `/health/live`." icon={Activity} />
            <SummaryCard label="Dispositivos sin estado" value={String(metrics.devicesWithoutStatus)} hint={`Home devices visibles: ${metrics.homeDevices}.`} icon={Smartphone} tone={metrics.devicesWithoutStatus === 0 ? "accent" : "warning"} />
            <SummaryCard label="Syncs con raw" value={`${metrics.rawAvailableSyncs}/${metrics.totalSyncs}`} hint={`Games: ${metrics.totalGames}, Profiles: ${metrics.totalProfiles}.`} icon={Layers3} tone="accent" />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte de la salud operativa: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Checks técnicos</CardTitle>
            <CardDescription>
              Estado real de readiness para base de datos, configuración y dependencias externas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {Object.entries(metrics.readinessChecks).length === 0 ? (
              <div className="rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">No hay checks técnicos para mostrar.</div>
            ) : (
              Object.entries(metrics.readinessChecks).map(([key, check]) => (
                <div key={key} className="rounded-2xl bg-white/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <Badge variant={check?.status === "healthy" ? "success" : "outline"}>{check?.status || "unknown"}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{check?.message || "Sin mensaje"}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-primary" />
            <CardTitle>Qué mirar primero</CardTitle>
            </div>
            <CardDescription>
              Resumen corto para arrancar por riesgo y no por intuición.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              Hay <strong>{metrics.devicesWithoutStatus}</strong> dispositivos sin estado, <strong>{metrics.unknownSourceSyncs}</strong> syncs sin origen claro y <strong>{metrics.profilesWithoutBindings}</strong> profiles sin bindings activos.
            </div>
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              La tasa agregada de éxito en turnos visibles es <strong>{metrics.successRate}%</strong> sobre <strong>{metrics.totalTurns}</strong> turnos persistidos.
            </div>
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              Última respuesta básica del backend: <strong>{formatDateTime(basicHealthQuery.data?.timestamp)}</strong>.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Dispositivos recientes</CardTitle>
                <CardDescription>
                  Últimos dispositivos visibles para una revisión rápida de metadata y estado.
                </CardDescription>
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Firmware</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.recentDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No hay dispositivos para mostrar.
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
                          <Badge variant={device.status ? "success" : "outline"}>{device.status || "sin estado"}</Badge>
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
                <CardTitle>Syncs recientes</CardTitle>
                <CardDescription>
                  Trazabilidad rápida sobre sesiones sincronizadas visibles en el dashboard.
                </CardDescription>
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
                    <TableHead>Origen</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Raw</TableHead>
                    <TableHead>Sincronizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.recentSyncs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No hay sincronizaciones para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentSyncsPagination.paginatedItems.map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell className="max-w-52 truncate font-mono text-xs">{sync.syncId || sync.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sync.source || sync.sourceType || "desconocido"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{sync.deviceId || sync.bleDeviceId || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={(sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 ? "success" : "outline"}>
                            {(sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 ? "disponible" : "pendiente"}
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
