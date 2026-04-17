"use client";

import { type ComponentType, useMemo, useState } from "react";
import { Activity, Cpu, HardDriveDownload, Search, Users, Waves } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SyncsTable() {
  const { tokens, user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [rawFilter, setRawFilter] = useState<"all" | "with-raw" | "without-raw">("all");
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);

  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);

  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);

  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canReadOperationalSyncs = hasAnyPermission("ble_device:read", "ble-device:read");
  const isInstitutionAdminView = currentUser?.roles.includes("institution-admin") || false;

  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return syncs.filter((sync) => {
      const hasRaw = (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0;
      if (rawFilter === "with-raw" && !hasRaw) return false;
      if (rawFilter === "without-raw" && hasRaw) return false;
      if (!normalized) return true;

      const device = sync.bleDeviceId ? deviceById.get(sync.bleDeviceId) : null;
      const user = sync.userId ? userById.get(sync.userId) : null;

      return [
        sync.syncId,
        sync.source,
        sync.sourceType,
        sync.deckName,
        sync.deviceId,
        sync.bleDeviceId,
        sync.firmwareVersion,
        device?.name,
        device?.deviceId,
        user?.fullName,
        user?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [deviceById, query, rawFilter, syncs, userById]);

  const selectedSync = useMemo(
    () => filtered.find((sync) => sync.id === selectedSyncId) || syncs.find((sync) => sync.id === selectedSyncId) || null,
    [filtered, selectedSyncId, syncs],
  );

  const metrics = useMemo(() => {
    const withRaw = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0).length;
    const withParticipants = syncs.filter((sync) => sync.participants.length > 0).length;
    const withDeviceLink = syncs.filter((sync) => Boolean(sync.bleDeviceId || sync.deviceId)).length;
    const withFirmware = syncs.filter((sync) => Boolean(sync.firmwareVersion)).length;

    return {
      total: syncs.length,
      withRaw,
      withParticipants,
      withDeviceLink,
      withFirmware,
    };
  }, [syncs]);

  const selectedDevice = selectedSync?.bleDeviceId ? deviceById.get(selectedSync.bleDeviceId) : null;
  const selectedUser = selectedSync?.userId ? userById.get(selectedSync.userId) : null;
  const selectedRawKeys = Object.keys(selectedSync?.rawPayload || {});

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={canReadOperationalSyncs ? (isInstitutionAdminView ? "Institution admin" : "Trazabilidad") : "Mi actividad"}
        title="Sincronizaciones"
        description={
          canReadOperationalSyncs
            ? "La vista usa `/sync-sessions` como superficie operativa real del parque visible por ACL BLE, no solo como historial personal del usuario autenticado."
            : "Sin permiso BLE operativo, `/sync-sessions` vuelve a comportarse como historial personal del usuario autenticado."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por syncId, origen, mazo, dispositivo o usuario"
                className="pl-9"
              />
            </div>
            <select
              value={rawFilter}
              onChange={(event) => setRawFilter(event.target.value as "all" | "with-raw" | "without-raw")}
              className="h-10 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todas</option>
              <option value="with-raw">Solo con raw</option>
              <option value="without-raw">Solo sin raw</option>
            </select>
          </div>
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Alcance visible</p>
              <Badge variant={canReadOperationalSyncs ? "secondary" : "outline"}>
                {canReadOperationalSyncs ? "operativo por ACL BLE" : "historial personal"}
              </Badge>
              {isInstitutionAdminView ? <Badge variant="outline">institution-admin</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {canReadOperationalSyncs
                ? "Los resultados se abren al parque de dispositivos permitido por ACL. Si tu alcance está scopeado, vas a ver solo syncs de esa institución."
                : "Esta sesión no tiene lectura operativa de BLE, así que la tabla queda limitada a tus propias sincronizaciones."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {syncsQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Syncs" value={String(metrics.total)} hint="Sesiones visibles en la vista operativa actual." icon={Activity} />
            <SummaryCard label="Con raw" value={String(metrics.withRaw)} hint="Ayuda a validar trazabilidad e ingestión." icon={HardDriveDownload} />
            <SummaryCard label="Con participantes" value={String(metrics.withParticipants)} hint="Sesiones con proyección de jugadores usable." icon={Users} />
            <SummaryCard label="Con dispositivo" value={String(metrics.withDeviceLink)} hint="Sesiones enlazadas a BLE o device_id." icon={Waves} />
            <SummaryCard label="Con firmware" value={String(metrics.withFirmware)} hint="Útil para detectar variaciones de ingesta por versión." icon={Cpu} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Sesiones sincronizadas</CardTitle>
            <CardDescription>
              Seleccioná una sesión para inspeccionar contexto de dispositivo, usuario, participantes y payload raw más reciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {syncsQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : syncsQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(syncsQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sync ID</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Participantes</TableHead>
                    <TableHead>Raw</TableHead>
                    <TableHead>Sincronizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No hay sincronizaciones para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((sync) => {
                      const device = sync.bleDeviceId ? deviceById.get(sync.bleDeviceId) : null;
                      const user = sync.userId ? userById.get(sync.userId) : null;
                      const hasRaw = (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0;

                      return (
                        <TableRow
                          key={sync.id}
                          className={cn("cursor-pointer", selectedSyncId === sync.id && "bg-primary/5")}
                          onClick={() => setSelectedSyncId(sync.id)}
                        >
                          <TableCell className="max-w-56 truncate font-mono text-xs">{sync.syncId || sync.id}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sync.source || sync.sourceType || "desconocido"}</Badge>
                          </TableCell>
                          <TableCell>{device?.name || sync.deviceId || sync.bleDeviceId || "-"}</TableCell>
                          <TableCell>{user?.fullName || user?.email || sync.userId || "-"}</TableCell>
                          <TableCell>{sync.participants.length || sync.totalPlayers || 0}</TableCell>
                          <TableCell>
                            <Badge variant={hasRaw ? "success" : "outline"}>{hasRaw ? "disponible" : "pendiente"}</Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(sync.syncedAt || sync.receivedAt || sync.startedAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Detalle de sync</CardTitle>
            <CardDescription>
              Panel operativo para revisar rápidamente quién sincronizó, con qué dispositivo y qué evidencia raw quedó asociada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedSync ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí una sincronización para revisar su detalle.
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedSync.deckName || selectedSync.syncId || selectedSync.id}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedSync.syncId || selectedSync.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedSync.source || selectedSync.sourceType || "desconocido"}</Badge>
                      <Badge variant={selectedRawKeys.length > 0 || (selectedSync.rawRecordCount || 0) > 0 ? "success" : "outline"}>
                        raw {(selectedSync.rawRecordCount || selectedSync.rawRecordIds.length || 0) > 0 ? "disponible" : "pendiente"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Usuario: {selectedUser?.fullName || selectedUser?.email || selectedSync.userId || "-"}</p>
                    <p>Dispositivo: {selectedDevice?.name || selectedSync.deviceId || selectedSync.bleDeviceId || "-"}</p>
                    <p>Firmware: {selectedSync.firmwareVersion || "sin firmware"}</p>
                    <p>App: {selectedSync.appVersion || "sin versión"}</p>
                    <p>Participantes: {selectedSync.participants.length || selectedSync.totalPlayers || 0}</p>
                    <p>Sincronizado: {formatDateTime(selectedSync.syncedAt || selectedSync.receivedAt || selectedSync.startedAt)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Participantes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSync.participants.length === 0 ? (
                      <Badge variant="outline">sin participantes proyectados</Badge>
                    ) : (
                      selectedSync.participants.map((participant, index) => (
                        <Badge key={`${participant.id || participant.profileId || participant.playerName || index}`} variant="outline">
                          {participant.playerName || participant.profileName || participant.profileId || `Jugador ${index + 1}`}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Señales de trazabilidad</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">raw ids: {String(selectedSync.rawRecordCount || selectedSync.rawRecordIds.length || 0)}</Badge>
                    <Badge variant="outline">fragmentos: {String(selectedSync.rawFragmentCount || 0)}</Badge>
                    <Badge variant="outline">payload keys: {String(selectedRawKeys.length)}</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Payload raw más reciente</p>
                  <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedSync.rawPayload || {}, null, 2)}</pre>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
