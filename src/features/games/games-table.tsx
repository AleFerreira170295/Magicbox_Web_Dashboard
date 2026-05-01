"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Gamepad2, Search, TimerReset, Trophy, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { buildGameDetailHref, type GameAccessFilter, type GamePlayerModeFilter } from "@/features/games/game-route";
import { buildGameRows } from "@/features/games/game-view";
import { useInstitutions } from "@/features/institutions/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  onSelect,
  isActive = false,
  actionLabel = "Ver foco",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  onSelect?: () => void;
  isActive?: boolean;
  actionLabel?: string;
}) {
  return (
    <Card className={cn("border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]", isActive && "ring-2 ring-primary/20")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            aria-label={`${isActive ? "Foco activo para" : actionLabel} ${label}`}
            className={cn(
              "mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition",
              isActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5",
            )}
          >
            {isActive ? "Foco activo" : actionLabel}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getDeckInitials(deckName?: string | null) {
  return (deckName || "Partida")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "GM";
}

export function GamesTable() {
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q")?.trim() || "");
  const [institutionFilter, setInstitutionFilter] = useState<string>(() => searchParams.get("institutionId")?.trim() || "");
  const [playerModeFilter, setPlayerModeFilter] = useState<GamePlayerModeFilter>(() => {
    const value = searchParams.get("playerMode");
    return value === "manual" || value === "mixed" || value === "registered" ? value : "all";
  });
  const [accessFilter, setAccessFilter] = useState<GameAccessFilter>(() => {
    const value = searchParams.get("access");
    return value === "owned" || value === "institution" || value === "shared" || value === "unresolved" ? value : "all";
  });
  const linkedOwnerUserId = searchParams.get("ownerUserId")?.trim() || "";
  const linkedOwnerUserName = searchParams.get("ownerUserName")?.trim() || "";
  const linkedBleDeviceId = searchParams.get("bleDeviceId")?.trim() || "";
  const linkedDeviceId = searchParams.get("deviceId")?.trim() || "";
  const linkedDeviceName = searchParams.get("deviceName")?.trim() || "";
  const initialPage = Number(searchParams.get("page") || 1) > 0 ? Number(searchParams.get("page") || 1) : 1;
  const initialPageSize = Number(searchParams.get("pageSize") || 10);

  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data?.data]);

  const institutionById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution])), [institutions]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);
  const isResearcherView = currentUser?.roles.includes("researcher") || false;
  const isFamilyView = currentUser?.roles.includes("family") || false;
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const gameRows = useMemo(() => buildGameRows(games, devices, institutions, currentUser), [currentUser, devices, games, institutions]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const effectiveInstitutionFilter = institutionFilter || scopedInstitutionId || "";

    return gameRows.filter((game) => {
      if (linkedOwnerUserId && game.device?.ownerUserId !== linkedOwnerUserId) return false;
      if (linkedBleDeviceId && game.bleDeviceId !== linkedBleDeviceId) return false;
      if (linkedDeviceId && game.device?.deviceId !== linkedDeviceId) return false;
      if (effectiveInstitutionFilter && game.educationalCenterId !== effectiveInstitutionFilter) return false;

      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

      if (playerModeFilter === "manual" && !(manualCount > 0 && registeredCount === 0)) return false;
      if (playerModeFilter === "mixed" && !(manualCount > 0 && registeredCount > 0)) return false;
      if (playerModeFilter === "registered" && !(registeredCount > 0 && manualCount === 0)) return false;

      if (accessFilter === "owned" && !game.isOwnedByCurrentUser) return false;
      if (accessFilter === "institution" && !game.isInstitutionVisible) return false;
      if (accessFilter === "shared" && game.accessRelation !== "compartido visible") return false;
      if (accessFilter === "unresolved" && !game.hasUnresolvedAssociation) return false;

      if (!normalized) return true;

      return [
        game.deckName,
        game.gameId,
        game.bleDeviceId,
        game.institution?.name,
        game.device?.name,
        game.device?.deviceId,
        game.ownerLabel,
        game.accessRelation,
        ...game.players.map((player) => player.playerName),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [accessFilter, gameRows, institutionFilter, linkedBleDeviceId, linkedDeviceId, linkedOwnerUserId, playerModeFilter, query, scopedInstitutionId]);

  const pagination = useListPagination(filtered, initialPageSize === 20 || initialPageSize === 50 ? initialPageSize : 10, initialPage);

  const metrics = useMemo(() => {
    const totalPlayers = games.reduce((acc, game) => acc + (game.players.length || game.totalPlayers || 0), 0);
    const totalTurns = games.reduce((acc, game) => acc + game.turns.length, 0);
    const successfulTurns = games.reduce((acc, game) => acc + game.turns.filter((turn) => turn.success).length, 0);
    const mixedGames = games.filter((game) => {
      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;
      return manualCount > 0 && registeredCount > 0;
    }).length;

    return {
      totalGames: games.length,
      totalPlayers,
      totalTurns,
      mixedGames,
      unresolvedAssociations: gameRows.filter((game) => game.hasUnresolvedAssociation).length,
      ownedGames: gameRows.filter((game) => game.isOwnedByCurrentUser).length,
      institutionVisibleGames: gameRows.filter((game) => game.isInstitutionVisible).length,
      successRate: totalTurns > 0 ? Math.round((successfulTurns / totalTurns) * 100) : 0,
    };
  }, [gameRows, games]);

  const accessSegments = [
    { key: "all" as const, label: "Todas", count: metrics.totalGames },
    { key: "owned" as const, label: "Mis dispositivos", count: metrics.ownedGames },
    { key: "institution" as const, label: "Institución visible", count: metrics.institutionVisibleGames },
    { key: "shared" as const, label: "Compartidas", count: gameRows.filter((game) => game.accessRelation === "compartido visible").length },
    { key: "unresolved" as const, label: "Sin asociación resuelta", count: metrics.unresolvedAssociations },
  ];

  function resetFilters() {
    setQuery("");
    setInstitutionFilter("");
    setPlayerModeFilter("all");
    setAccessFilter("all");
  }

  const activeFilterChips = [
    query.trim() ? `Búsqueda · ${query.trim()}` : null,
    (institutionFilter || scopedInstitutionId) ? `Institución · ${institutionById.get(institutionFilter || scopedInstitutionId || "")?.name || institutionFilter || scopedInstitutionId}` : null,
    playerModeFilter !== "all" ? `Jugadores · ${playerModeFilter === "mixed" ? "Mixtos" : playerModeFilter === "manual" ? "Solo manuales" : "Solo registrados"}` : null,
    accessFilter !== "all" ? `Acceso · ${accessSegments.find((segment) => segment.key === accessFilter)?.label || accessFilter}` : null,
    linkedOwnerUserId ? `Usuario · ${linkedOwnerUserName || linkedOwnerUserId}` : null,
    linkedBleDeviceId || linkedDeviceId ? `Dispositivo · ${linkedDeviceName || linkedDeviceId || linkedBleDeviceId}` : null,
  ].filter((value): value is string => Boolean(value));

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (institutionFilter) params.set("institutionId", institutionFilter);
    if (playerModeFilter !== "all") params.set("playerMode", playerModeFilter);
    if (accessFilter !== "all") params.set("access", accessFilter);
    if (linkedOwnerUserId) params.set("ownerUserId", linkedOwnerUserId);
    if (linkedOwnerUserName) params.set("ownerUserName", linkedOwnerUserName);
    if (linkedBleDeviceId) params.set("bleDeviceId", linkedBleDeviceId);
    if (linkedDeviceId) params.set("deviceId", linkedDeviceId);
    if (linkedDeviceName) params.set("deviceName", linkedDeviceName);
    if (pagination.currentPage > 1) params.set("page", String(pagination.currentPage));
    if (pagination.pageSize !== 10) params.set("pageSize", String(pagination.pageSize));

    const nextSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (nextSearch !== currentSearch) {
      router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
    }
  }, [accessFilter, institutionFilter, linkedBleDeviceId, linkedDeviceId, linkedDeviceName, linkedOwnerUserId, linkedOwnerUserName, pagination.currentPage, pagination.pageSize, pathname, playerModeFilter, query, router, searchParams]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isFamilyView ? "Family" : isResearcherView ? "Researcher" : isTeacherView ? "Teacher" : isDirectorView ? "Director" : isInstitutionScopedView ? "Institution admin" : "Juego"}
        title="Partidas"
        description={
          isFamilyView
            ? "Vista simple para entender sesiones, participantes y ritmo general sin entrar en detalle técnico innecesario."
            : isResearcherView
            ? "Vista de muestra de partidas para leer composición, asociaciones y densidad de turnos sin mezclarlo con operación de aula."
            : isTeacherView
            ? "Vista de aula para el docente, priorizando qué se jugó, con quién y desde qué dispositivo para conectar rápido actividad y contexto."
            : isDirectorView
            ? `Vista de seguimiento institucional de partidas para ${scopedInstitutionName || "la institución"}, enfocada en volumen, mezcla de participantes y señales generales sin ruido técnico.`
            : isInstitutionScopedView
            ? `Vista de partidas para ${scopedInstitutionName}, alineada al acceso institucional disponible.`
            : "Vista de partidas con contexto de institución, dispositivo, jugadores y desempeño, para seguir el recorrido de sync a partida con una lectura clara."
        }
        actions={
          <div className="grid w-full gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.8fr)_minmax(210px,0.7fr)_minmax(220px,0.8fr)]">
            <div className="relative min-w-0 md:col-span-2 2xl:col-span-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por mazo, gameId, institución, dispositivo o jugador"
                className="w-full pl-9"
              />
            </div>
            {isFamilyView ? null : (
              <>
                <select
                  value={institutionFilter || scopedInstitutionId || ""}
                  onChange={(event) => setInstitutionFilter(event.target.value)}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={Boolean(scopedInstitutionId)}
                >
                  <option value="">Todas las instituciones</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
                <select
                  value={playerModeFilter}
                  onChange={(event) => setPlayerModeFilter(event.target.value as "all" | "manual" | "mixed" | "registered")}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos los modos</option>
                  <option value="registered">Solo registrados</option>
                  <option value="manual">Solo manuales</option>
                  <option value="mixed">Mixtos</option>
                </select>
                <select
                  value={accessFilter}
                  onChange={(event) => setAccessFilter(event.target.value as "all" | "owned" | "institution" | "shared" | "unresolved")}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos los accesos</option>
                  <option value="owned">Mis dispositivos</option>
                  <option value="institution">Institución visible</option>
                  <option value="shared">Compartidas</option>
                  <option value="unresolved">Sin asociación resuelta</option>
                </select>
                {linkedOwnerUserId || linkedBleDeviceId || linkedDeviceId ? (
                  <button
                    type="button"
                    onClick={() => router.push(pathname)}
                    className="inline-flex h-10 min-w-0 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-3 text-sm font-medium text-primary transition hover:bg-primary/10"
                  >
                    Quitar filtro cruzado
                  </button>
                ) : null}
              </>
            )}
          </div>
        }
      />

      {(scopedInstitutionName || linkedOwnerUserId || linkedBleDeviceId || linkedDeviceId) ? (
        <div className="flex flex-wrap gap-2">
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
          {linkedOwnerUserId ? <Badge variant="outline">Usuario filtrado: {linkedOwnerUserName || linkedOwnerUserId}</Badge> : null}
          {linkedBleDeviceId || linkedDeviceId ? <Badge variant="outline">Dispositivo filtrado: {linkedDeviceName || linkedDeviceId || linkedBleDeviceId}</Badge> : null}
        </div>
      ) : null}

      {isResearcherView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Composición de muestra</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Leé rápido cuántas sesiones combinan manuales y registrados, y cómo queda representada la muestra disponible.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Asociaciones clave</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">La relación entre partida, dispositivo y responsable queda clara para interpretar cada caso sin ambigüedades.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Turnos observables</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">La muestra destaca densidad de turnos, tasa de éxito y contexto de jugador con una lectura directa.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isFamilyView ? null : (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Acceso disponible</p>
                <p className="text-sm text-muted-foreground">Recortá la muestra por tipo de acceso antes de abrir una partida.</p>
              </div>
              <Badge variant="outline">{filtered.length} resultados</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
            {accessSegments.map((segment) => (
              <button
                key={segment.key}
                type="button"
                onClick={() => setAccessFilter(segment.key)}
                className={cn(
                  "inline-flex w-full items-center justify-between gap-2 rounded-full border px-4 py-2 text-left text-sm font-medium transition sm:w-auto sm:justify-center",
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
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {gamesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={isFamilyView ? "Partidas" : isResearcherView ? "Muestra" : "Partidas"} value={String(metrics.totalGames)} icon={Gamepad2} onSelect={resetFilters} isActive={!query.trim() && !institutionFilter && playerModeFilter === "all" && accessFilter === "all" && !linkedOwnerUserId && !linkedBleDeviceId && !linkedDeviceId} actionLabel="Ver todas" />
            <SummaryCard label={isResearcherView ? "Participantes" : "Jugadores"} value={String(metrics.totalPlayers)} icon={Users} />
            <SummaryCard label="Turnos" value={String(metrics.totalTurns)} icon={TimerReset} />
            <SummaryCard label={isFamilyView ? "Mazos" : isResearcherView ? "Muestra mixta" : "Mixtas"} value={String(isFamilyView ? new Set(games.map((game) => game.deckName).filter(Boolean)).size : metrics.mixedGames)} icon={BookOpen} onSelect={isFamilyView ? undefined : () => setPlayerModeFilter("mixed")} isActive={playerModeFilter === "mixed"} />
            <SummaryCard label={isFamilyView ? "Tasa de aciertos" : isResearcherView ? "Sin asociación" : "Sin asociación"} value={isFamilyView ? `${metrics.successRate}%` : String(metrics.unresolvedAssociations)} icon={isFamilyView ? Trophy : Gamepad2} onSelect={isFamilyView ? undefined : () => setAccessFilter("unresolved")} isActive={accessFilter === "unresolved"} />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-foreground">Resultados</p>
            <p className="mt-1 text-sm text-muted-foreground">{filtered.length} de {metrics.totalGames} partidas con el recorte actual.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeFilterChips.length > 0 ? activeFilterChips.map((chip) => <Badge key={chip} variant="outline">{chip}</Badge>) : <Badge variant="outline">Vista general</Badge>}
            {activeFilterChips.length > 0 ? <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent">Limpiar</button> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{isFamilyView ? "Actividad reciente" : isResearcherView ? "Muestra de partidas" : isTeacherView ? "Partidas para aula" : isDirectorView ? "Partidas para seguimiento" : "Listado de partidas"}</CardTitle>
              <CardDescription>
                {isFamilyView
                  ? "Abrí una partida para ver su detalle dedicado con participantes, turnos y ritmo general."
                  : isResearcherView
                  ? "Abrí una partida para revisar composición, turnos, navegación relacionada y gráfico de resultados por turno."
                  : isTeacherView
                  ? "Abrí una partida para entrar a su pantalla dedicada con contexto del dispositivo, participantes y desempeño."
                  : isDirectorView
                  ? "Abrí una partida para revisar contexto institucional, navegación relacionada y desempeño turno a turno."
                  : "Abrí una partida para entrar a su detalle dedicado sin perder el contexto del recorte actual."}
              </CardDescription>
            </div>
            <ListPaginationControls
              pageSize={pagination.pageSize}
              setPageSize={pagination.setPageSize}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              paginationStart={pagination.paginationStart}
              paginationEnd={pagination.paginationEnd}
              goToPreviousPage={pagination.goToPreviousPage}
              goToNextPage={pagination.goToNextPage}
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[720px] overflow-auto p-0">
          {gamesQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : gamesQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(gamesQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Game ID</TableHead>
                  <TableHead>Mazo</TableHead>
                  {isFamilyView ? null : <TableHead>Institución</TableHead>}
                  {isFamilyView ? null : <TableHead>Dispositivo</TableHead>}
                  {isFamilyView ? null : <TableHead>Acceso</TableHead>}
                  <TableHead>Jugadores</TableHead>
                  <TableHead>Turnos</TableHead>
                  <TableHead>Inicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFamilyView ? 5 : 8} className="py-10 text-center text-sm text-muted-foreground">
                      No hay partidas para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedItems.map((game) => {
                    const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
                    const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

                    return (
                      <TableRow
                        key={game.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(
                            buildGameDetailHref({
                              gameRecordId: game.id,
                              q: query.trim(),
                              institutionId: institutionFilter,
                              playerMode: playerModeFilter,
                              access: accessFilter,
                              ownerUserId: linkedOwnerUserId,
                              ownerUserName: linkedOwnerUserName,
                              bleDeviceId: linkedBleDeviceId,
                              deviceId: linkedDeviceId,
                              deviceName: linkedDeviceName,
                              page: pagination.currentPage,
                              pageSize: pagination.pageSize,
                            }),
                          )
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-[11px] font-semibold text-primary">
                              {getDeckInitials(game.deckName)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{game.gameId || "-"}</p>
                              <p className="text-xs text-muted-foreground">{game.playerMixLabel}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm text-foreground">{game.deckName || "-"}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={game.hasUnresolvedAssociation ? "warning" : "outline"}>{game.hasUnresolvedAssociation ? "revisar asociación" : "asociación visible"}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        {isFamilyView ? null : <TableCell>{game.institution?.name || game.educationalCenterId || "-"}</TableCell>}
                        {isFamilyView ? null : <TableCell>{game.device?.name || game.device?.deviceId || game.bleDeviceId || "-"}</TableCell>}
                        {isFamilyView ? null : (
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={game.hasUnresolvedAssociation ? "warning" : "outline"}>{game.accessRelation}</Badge>
                              <span className="text-xs text-muted-foreground">{game.ownerLabel}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{game.players.length || game.totalPlayers || 0}</Badge>
                            <Badge variant={game.playerMixLabel === "mixta" ? "secondary" : "outline"}>{game.playerMixLabel}</Badge>
                            {registeredCount > 0 ? <Badge variant="outline">registrados {registeredCount}</Badge> : null}
                            {manualCount > 0 ? <Badge variant="success">manuales {manualCount}</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{game.turns.length}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(game.startDate)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
