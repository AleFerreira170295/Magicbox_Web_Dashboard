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
import { useGames } from "@/features/games/api";
import type { GameRecord } from "@/features/games/types";
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
  const [accessFilter, setAccessFilter] = useState<"all" | "owned" | "institution" | "shared" | "unresolved">("all");
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);

  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);

  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);

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
  const isResearcherView = currentUser?.roles.includes("researcher") || false;
  const isFamilyView = currentUser?.roles.includes("family") || false;
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const gameById = useMemo(() => {
    const entries: Array<[string, GameRecord]> = [];

    games.forEach((game) => {
      entries.push([String(game.id), game]);
      if (game.gameId != null) {
        entries.push([String(game.gameId), game]);
      }
    });

    return new Map<string, GameRecord>(entries);
  }, [games]);

  const syncRows = useMemo(() => {
    const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();

    return syncs.map((sync) => {
      const device = sync.bleDeviceId ? deviceById.get(sync.bleDeviceId) : null;
      const user = sync.userId ? userById.get(sync.userId) : null;
      const matchedGame = sync.gameId ? gameById.get(String(sync.gameId)) : null;
      const hasRaw = (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0;

      const isOwnedByCurrentUser = Boolean(
        device && (
          (currentUser?.id && device.ownerUserId === currentUser.id)
          || (currentUserEmail && (device.ownerUserEmail || "").trim().toLowerCase() === currentUserEmail)
        ),
      );
      const isInstitutionVisible = Boolean(
        device?.educationalCenterId
        && currentUser?.educationalCenterId
        && device.educationalCenterId === currentUser.educationalCenterId,
      );

      const accessRelation = !canReadOperationalSyncs
        ? "historial personal"
        : isOwnedByCurrentUser
          ? "mis dispositivos"
          : isInstitutionVisible
            ? "institución visible"
            : device?.ownerUserId || device?.ownerUserEmail
              ? "compartido visible"
              : "sin asociación resuelta";

      return {
        ...sync,
        device,
        user,
        matchedGame,
        hasRaw,
        accessRelation,
        isOwnedByCurrentUser,
        isInstitutionVisible,
        hasUnresolvedAssociation: !device || accessRelation === "sin asociación resuelta",
      };
    });
  }, [canReadOperationalSyncs, currentUser, deviceById, gameById, syncs, userById]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return syncRows.filter((sync) => {
      if (rawFilter === "with-raw" && !sync.hasRaw) return false;
      if (rawFilter === "without-raw" && sync.hasRaw) return false;
      if (accessFilter === "owned" && !sync.isOwnedByCurrentUser) return false;
      if (accessFilter === "institution" && !sync.isInstitutionVisible) return false;
      if (accessFilter === "shared" && sync.accessRelation !== "compartido visible") return false;
      if (accessFilter === "unresolved" && !sync.hasUnresolvedAssociation) return false;
      if (!normalized) return true;

      return [
        sync.syncId,
        sync.source,
        sync.sourceType,
        sync.deckName,
        sync.deviceId,
        sync.bleDeviceId,
        sync.firmwareVersion,
        sync.device?.name,
        sync.device?.deviceId,
        sync.user?.fullName,
        sync.user?.email,
        sync.accessRelation,
        sync.matchedGame?.deckName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [accessFilter, query, rawFilter, syncRows]);

  const selectedSync = useMemo(
    () => filtered.find((sync) => sync.id === selectedSyncId) || syncRows.find((sync) => sync.id === selectedSyncId) || null,
    [filtered, selectedSyncId, syncRows],
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
      ownedSyncs: syncRows.filter((sync) => sync.isOwnedByCurrentUser).length,
      institutionSyncs: syncRows.filter((sync) => sync.isInstitutionVisible).length,
      unresolvedAssociations: syncRows.filter((sync) => sync.hasUnresolvedAssociation).length,
      matchedGames: syncRows.filter((sync) => Boolean(sync.matchedGame)).length,
    };
  }, [syncRows, syncs]);

  const selectedDevice = selectedSync?.device || null;
  const selectedUser = selectedSync?.user || null;
  const selectedRawKeys = Object.keys(selectedSync?.rawPayload || {});
  const accessSegments = [
    { key: "all" as const, label: "Todas", count: metrics.total },
    { key: "owned" as const, label: "Mis dispositivos", count: metrics.ownedSyncs },
    { key: "institution" as const, label: "Institución visible", count: metrics.institutionSyncs },
    { key: "shared" as const, label: "Compartidas", count: syncRows.filter((sync) => sync.accessRelation === "compartido visible").length },
    { key: "unresolved" as const, label: "Sin asociación resuelta", count: metrics.unresolvedAssociations },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isFamilyView ? "Family" : isResearcherView ? "Researcher" : canReadOperationalSyncs ? (isTeacherView ? "Teacher" : isDirectorView ? "Director" : isInstitutionAdminView ? "Institution admin" : "Trazabilidad") : isTeacherView ? "Teacher" : "Mi actividad"}
        title="Sincronizaciones"
        description={
          isFamilyView
            ? "Vista simple para seguir la actividad de sincronización visible, con foco en si hubo captura, participantes y relación básica con las partidas."
            : isResearcherView
            ? "Vista de evidencia sobre `/sync-sessions`, pensada para leer cobertura de captura, correlación con partidas y asociaciones visibles sin quedarse solo en el payload raw."
            : canReadOperationalSyncs
            ? isTeacherView
              ? "Vista docente de sincronizaciones visibles, pensada para conectar captura, participantes y dispositivo sin convertir la lectura en una consola técnica."
              : isDirectorView
              ? "Vista directoral de sincronizaciones visibles, útil para seguir captura, correlación con partidas y señales generales de trazabilidad a nivel institución."
              : "La vista usa `/sync-sessions` como superficie operativa real del parque visible por ACL BLE, no solo como historial personal del usuario autenticado."
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
            {isFamilyView ? null : (
              <>
                <select
                  value={rawFilter}
                  onChange={(event) => setRawFilter(event.target.value as "all" | "with-raw" | "without-raw")}
                  className="h-10 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todas</option>
                  <option value="with-raw">Solo con raw</option>
                  <option value="without-raw">Solo sin raw</option>
                </select>
                <select
                  value={accessFilter}
                  onChange={(event) => setAccessFilter(event.target.value as "all" | "owned" | "institution" | "shared" | "unresolved")}
                  className="h-10 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos los accesos</option>
                  <option value="owned">Mis dispositivos</option>
                  <option value="institution">Institución visible</option>
                  <option value="shared">Compartidas</option>
                  <option value="unresolved">Sin asociación resuelta</option>
                </select>
              </>
            )}
          </div>
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Alcance visible</p>
              <Badge variant={isFamilyView || isResearcherView || canReadOperationalSyncs ? "secondary" : "outline"}>
                {isFamilyView ? "family" : isResearcherView ? "researcher" : canReadOperationalSyncs ? "operativo por ACL BLE" : "historial personal"}
              </Badge>
              {isTeacherView && canReadOperationalSyncs ? <Badge variant="outline">teacher</Badge> : null}
              {isDirectorView && canReadOperationalSyncs ? <Badge variant="outline">director</Badge> : null}
              {isInstitutionAdminView ? <Badge variant="outline">institution-admin</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isFamilyView
                ? "La vista simplifica la lectura y deja visibles solo las relaciones más importantes, sincronización, participantes, dispositivo y vínculo con una partida cuando existe."
                : isResearcherView
                ? "La vista mantiene el scope visible real y deja explícita la relación entre sync, dispositivo, usuario y partida correlacionada para revisar evidencia de captura sin bajar directo al raw completo."
                : canReadOperationalSyncs
                ? isTeacherView
                  ? "La lectura docente deja explícito por qué la sync entra en tu alcance, qué dispositivo la originó y si ya se puede conectar con participantes o una partida visible."
                  : isDirectorView
                  ? "La lectura directoral deja en primer plano cobertura, correlación con partidas y señales generales de trazabilidad para seguimiento institucional."
                  : "Los resultados se abren al parque de dispositivos permitido por ACL. Si tu alcance está scopeado, vas a ver solo syncs de esa institución."
                : "Esta sesión no tiene lectura operativa de BLE, así que la tabla queda limitada a tus propias sincronizaciones."}
            </p>
          </div>
        </CardContent>
      </Card>

      {isResearcherView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Cobertura de captura</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Se hace explícito qué parte de la muestra tiene raw visible y qué parte todavía queda incompleta.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Correlación con partida</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">La relación entre sync y game visible ayuda a leer continuidad sin saltar entre pantallas para cada caso.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Asociaciones visibles</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Dispositivo, usuario y participantes quedan resumidos con lenguaje de evidencia y no solo de operación.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isFamilyView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Actividad visible</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">La pantalla muestra si hubo sincronizaciones recientes y qué parte de la experiencia quedó capturada.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Participantes</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Cuando hay información disponible, se presenta en lenguaje simple y fácil de seguir.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Relación con partidas</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Si una sync puede vincularse con una partida visible, la conexión queda resumida sin meterse en detalles técnicos.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isFamilyView ? null : (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="flex flex-wrap gap-2 p-5">
            {accessSegments.map((segment) => (
              <button
                key={segment.key}
                type="button"
                onClick={() => setAccessFilter(segment.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  accessFilter === segment.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                <span>{segment.label}</span>
                <Badge variant={accessFilter === segment.key ? "secondary" : "outline"} className={accessFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                  {segment.count}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {syncsQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={isFamilyView ? "Syncs" : isResearcherView ? "Muestra sync" : "Syncs"} value={String(metrics.total)} hint={isFamilyView ? "Sincronizaciones visibles en esta cuenta." : isResearcherView ? "Sesiones visibles dentro de la evidencia actual." : "Sesiones visibles en la vista operativa actual."} icon={Activity} />
            <SummaryCard label="Con evidencia" value={String(metrics.withRaw)} hint={isFamilyView ? "Syncs donde quedó alguna evidencia cruda disponible." : isResearcherView ? "Cobertura observable de captura cruda." : "Ayuda a validar trazabilidad e ingestión."} icon={HardDriveDownload} />
            <SummaryCard label="Con participantes" value={String(metrics.withParticipants)} hint={isFamilyView ? "Syncs con participantes proyectados visibles." : isResearcherView ? "Syncs con proyección de participantes usable para análisis." : "Sesiones con proyección de jugadores usable."} icon={Users} />
            <SummaryCard label="Con dispositivo" value={String(metrics.withDeviceLink)} hint={isFamilyView ? "Sincronizaciones enlazadas a un dispositivo visible." : isResearcherView ? "Sesiones enlazadas a un dispositivo visible." : "Sesiones enlazadas a BLE o device_id."} icon={Waves} />
            <SummaryCard label={isFamilyView ? "Con versión" : "Con firmware"} value={String(metrics.withFirmware)} hint={isFamilyView ? "Syncs donde quedó registrada alguna versión visible." : isResearcherView ? "Sirve para detectar sesgos o variaciones por versión." : "Útil para detectar variaciones de ingesta por versión."} icon={Cpu} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{isFamilyView ? "Actividad de sincronización" : isResearcherView ? "Muestra visible de sincronizaciones" : isTeacherView ? "Sincronizaciones visibles para aula" : isDirectorView ? "Sincronizaciones visibles para seguimiento" : "Sesiones sincronizadas"}</CardTitle>
            <CardDescription>
              {isFamilyView
                ? "Seleccioná una sincronización para ver un resumen simple de participantes, dispositivo y relación con la partida cuando exista."
                : isResearcherView
                ? "Seleccioná una sesión para inspeccionar contexto visible, participantes proyectados y correlación con partida sin salir del dashboard."
                : isTeacherView
                ? "Seleccioná una sincronización para entender rápido dispositivo, participantes y vínculo con partida desde una lectura docente."
                : isDirectorView
                ? "Seleccioná una sincronización para revisar trazabilidad general, correlación con partida y contexto institucional visible."
                : "Seleccioná una sesión para inspeccionar contexto de dispositivo, usuario, participantes y payload raw más reciente."}
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
                    {isFamilyView ? null : <TableHead>Usuario</TableHead>}
                    {isFamilyView ? null : <TableHead>Acceso</TableHead>}
                    <TableHead>Participantes</TableHead>
                    <TableHead>Raw</TableHead>
                    <TableHead>Sincronizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isFamilyView ? 6 : 8} className="py-10 text-center text-sm text-muted-foreground">
                        No hay sincronizaciones para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((sync) => {
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
                          <TableCell>{sync.device?.name || sync.deviceId || sync.bleDeviceId || "-"}</TableCell>
                          {isFamilyView ? null : <TableCell>{sync.user?.fullName || sync.user?.email || sync.userId || "-"}</TableCell>}
                          {isFamilyView ? null : (
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={sync.hasUnresolvedAssociation ? "warning" : "outline"}>{sync.accessRelation}</Badge>
                                {sync.matchedGame ? <span className="text-xs text-muted-foreground">partida {sync.matchedGame.gameId || sync.matchedGame.id}</span> : null}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>{sync.participants.length || sync.totalPlayers || 0}</TableCell>
                          <TableCell>
                            <Badge variant={sync.hasRaw ? "success" : "outline"}>{sync.hasRaw ? "disponible" : "pendiente"}</Badge>
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
            <CardTitle>{isFamilyView ? "Resumen de sincronización" : isResearcherView ? "Detalle de evidencia" : isTeacherView ? "Detalle para aula" : isDirectorView ? "Detalle de seguimiento" : "Detalle de sync"}</CardTitle>
            <CardDescription>
              {isFamilyView
                ? "Resumen simple para entender qué se sincronizó, quiénes aparecen y si hay evidencia asociada."
                : isResearcherView
                ? "Panel para revisar rápidamente relaciones visibles entre sync, usuario, dispositivo, participantes y evidencia cruda asociada."
                : isTeacherView
                ? "Panel docente para revisar rápido quién sincronizó, con qué dispositivo y si ya hay participantes o partida visible asociada."
                : isDirectorView
                ? "Panel de seguimiento para revisar correlación visible entre sync, dispositivo, participantes y evidencia cruda sin entrar en lectura excesivamente técnica."
                : "Panel operativo para revisar rápidamente quién sincronizó, con qué dispositivo y qué evidencia raw quedó asociada."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedSync ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                {isFamilyView ? "Elegí una sincronización para revisar un resumen simple de actividad." : isResearcherView ? "Elegí una sincronización para revisar su detalle de evidencia." : isTeacherView ? "Elegí una sincronización para revisar su detalle de aula." : isDirectorView ? "Elegí una sincronización para revisar su detalle de seguimiento." : "Elegí una sincronización para revisar su detalle."}
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
                    {isFamilyView ? null : <p>Usuario: {selectedUser?.fullName || selectedUser?.email || selectedSync.userId || "-"}</p>}
                    <p>Dispositivo: {selectedDevice?.name || selectedSync.deviceId || selectedSync.bleDeviceId || "-"}</p>
                    {isFamilyView ? null : <p>Relación de acceso: {selectedSync.accessRelation}</p>}
                    <p>Partida correlacionada: {selectedSync.matchedGame?.deckName || selectedSync.gameId || "sin match visible"}</p>
                    <p>Firmware: {selectedSync.firmwareVersion || "sin firmware"}</p>
                    <p>App: {selectedSync.appVersion || "sin versión"}</p>
                    <p>Participantes: {selectedSync.participants.length || selectedSync.totalPlayers || 0}</p>
                    <p>Sincronizado: {formatDateTime(selectedSync.syncedAt || selectedSync.receivedAt || selectedSync.startedAt)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Participantes visibles" : isResearcherView ? "Participantes y asociaciones visibles" : isTeacherView ? "Participantes y contexto de aula" : isDirectorView ? "Participantes y contexto institucional" : "Participantes y asociaciones"}</p>
                  <div className="mt-3 space-y-3">
                    {selectedSync.participants.length === 0 ? (
                      <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">Sin participantes proyectados.</div>
                    ) : (
                      selectedSync.participants.map((participant, index) => (
                        <div key={`${participant.id || participant.profileId || participant.playerName || index}`} className="rounded-2xl bg-background/70 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{participant.playerName || participant.profileName || participant.profileId || `Jugador ${index + 1}`}</p>
                              <p className="text-xs text-muted-foreground">{participant.studentId || participant.externalPlayerUid || participant.id || "sin id enlazado"}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {participant.cardUid ? <Badge variant="outline">card {participant.cardUid}</Badge> : null}
                              {participant.position != null ? <Badge variant="outline">posición {participant.position}</Badge> : null}
                              {participant.profileId ? <Badge variant="secondary">perfil vinculado</Badge> : <Badge variant="outline">sin perfil</Badge>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Señales de sincronización" : isResearcherView ? "Señales de evidencia" : isTeacherView ? "Señales útiles para aula" : isDirectorView ? "Señales de seguimiento" : "Señales de trazabilidad"}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">raw ids: <span className="font-medium text-foreground">{String(selectedSync.rawRecordCount || selectedSync.rawRecordIds.length || 0)}</span></div>
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">fragmentos: <span className="font-medium text-foreground">{String(selectedSync.rawFragmentCount || 0)}</span></div>
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">payload keys: <span className="font-medium text-foreground">{String(selectedRawKeys.length)}</span></div>
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">match con partida: <span className="font-medium text-foreground">{selectedSync.matchedGame ? "sí" : "no"}</span></div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Detalle visible" : isResearcherView ? "Payload raw visible" : "Payload raw más reciente"}</p>
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
