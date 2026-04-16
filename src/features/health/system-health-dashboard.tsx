"use client";

import { useMemo } from "react";
import { Activity, AlertTriangle, Layers3, ShieldCheck, Smartphone } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
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
  icon: React.ComponentType<{ className?: string }>;
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
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const isLoading = devicesQuery.isLoading || syncsQuery.isLoading;
  const error = devicesQuery.error || syncsQuery.error;

  const metrics = useMemo(() => {
    const devices = devicesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];

    const devicesWithStatus = devices.filter((device) => device.status).length;
    const devicesWithoutStatus = devices.length - devicesWithStatus;
    const rawAvailableSyncs = syncs.filter((sync) => sync.rawRecordIds.length > 0 || sync.rawPayload).length;
    const unknownSourceSyncs = syncs.filter((sync) => !(sync.source || sync.sourceType)).length;

    return {
      totalDevices: devicesQuery.data?.total || devices.length,
      devicesWithStatus,
      devicesWithoutStatus,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      rawAvailableSyncs,
      unknownSourceSyncs,
      recentDevices: devices.slice(0, 6),
      recentSyncs: syncs.slice(0, 6),
    };
  }, [devicesQuery.data, syncsQuery.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Salud operativa"
        description="Vista central para revisar el estado general del parque de dispositivos y la calidad visible de la sincronización, sin tener que navegar módulo por módulo."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Dispositivos visibles"
              value={String(metrics.totalDevices)}
              hint="Punto de partida para entender el estado general del parque activo."
              icon={Smartphone}
            />
            <SummaryCard
              label="Dispositivos sin estado"
              value={String(metrics.devicesWithoutStatus)}
              hint="Buena señal temprana para revisar calidad de metadata y reporting."
              icon={AlertTriangle}
              tone="warning"
            />
            <SummaryCard
              label="Sincronizaciones visibles"
              value={String(metrics.totalSyncs)}
              hint="Volumen base de actividad y consistencia del sistema."
              icon={Layers3}
              tone="accent"
            />
            <SummaryCard
              label="Syncs con raw disponible"
              value={String(metrics.rawAvailableSyncs)}
              hint="Nos dice cuánto de la trazabilidad completa ya está efectivamente visible."
              icon={ShieldCheck}
              tone="accent"
            />
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

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Señales que conviene vigilar</CardTitle>
            <CardDescription>
              Esta lectura sirve como base para un futuro tablero de alertas y soporte.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Estados incompletos en dispositivos</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Hoy hay <strong>{metrics.devicesWithoutStatus}</strong> dispositivos visibles sin estado explícito.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Sincronizaciones sin origen claro</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Hay <strong>{metrics.unknownSourceSyncs}</strong> syncs donde el origen no está claramente expresado.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Trazabilidad disponible</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                <strong>{metrics.rawAvailableSyncs}</strong> syncs muestran raw o rawRecordIds visibles en la UI actual.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              <CardTitle>Lectura rápida</CardTitle>
            </div>
            <CardDescription>
              Una síntesis para revisar salud del sistema en pocos segundos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              Si hoy tuvieras que priorizar una revisión, conviene empezar por dispositivos sin estado y syncs sin origen claro.
            </div>
            <div className="rounded-2xl bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
              En la siguiente fase, esta pantalla debería incorporar alertas suaves, umbrales y agrupación por institución.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Dispositivos recientes</CardTitle>
            <CardDescription>
              Últimos dispositivos visibles para una revisión operativa rápida.
            </CardDescription>
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
                    <TableHead>Device ID</TableHead>
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
                    metrics.recentDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
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
            <CardTitle>Sincronizaciones recientes</CardTitle>
            <CardDescription>
              Primer bloque para revisar la calidad visible del flujo de sincronización.
            </CardDescription>
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
                    metrics.recentSyncs.map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell className="max-w-52 truncate font-mono text-xs">{sync.syncId || sync.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{sync.source || sync.sourceType || "desconocido"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{sync.bleDeviceId || sync.deviceId || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={sync.rawRecordIds.length > 0 || sync.rawPayload ? "success" : "outline"}>
                            {sync.rawRecordIds.length > 0 || sync.rawPayload ? "disponible" : "pendiente"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(sync.syncedAt || sync.startedAt)}</TableCell>
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
