"use client";

import { type ComponentType, useMemo, useState } from "react";
import { BookOpen, Gamepad2, Search, TimerReset, Trophy, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
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

export function GamesTable() {
  const { tokens, user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const [playerModeFilter, setPlayerModeFilter] = useState<"all" | "manual" | "mixed" | "registered">("all");
  const [accessFilter, setAccessFilter] = useState<"all" | "owned" | "institution" | "shared" | "unresolved">("all");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data?.data]);

  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const institutionById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution])), [institutions]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);
  const isResearcherView = currentUser?.roles.includes("researcher") || false;
  const isFamilyView = currentUser?.roles.includes("family") || false;
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const gameRows = useMemo(() => {
    const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();

    return games.map((game) => {
      const institution = game.educationalCenterId ? institutionById.get(game.educationalCenterId) : null;
      const device = game.bleDeviceId ? deviceById.get(game.bleDeviceId) : null;
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

      const accessRelation = isOwnedByCurrentUser
        ? "mis dispositivos"
        : isInstitutionVisible
          ? "institución visible"
          : device?.ownerUserId || device?.ownerUserEmail
            ? "compartido visible"
            : "sin asociación resuelta";

      const ownerLabel = device?.ownerUserName || device?.ownerUserEmail || "sin responsable";
      const playerCount = game.players.length || game.totalPlayers || 0;

      return {
        ...game,
        institution,
        device,
        ownerLabel,
        accessRelation,
        isOwnedByCurrentUser,
        isInstitutionVisible,
        hasUnresolvedAssociation: !device || !game.educationalCenterId || accessRelation === "sin asociación resuelta",
        playerCount,
      };
    });
  }, [currentUser, deviceById, games, institutionById]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const effectiveInstitutionFilter = institutionFilter || scopedInstitutionId || "";

    return gameRows.filter((game) => {
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
  }, [accessFilter, gameRows, institutionFilter, playerModeFilter, query, scopedInstitutionId]);

  const selectedGame = useMemo(
    () => filtered.find((game) => game.id === selectedGameId) || gameRows.find((game) => game.id === selectedGameId) || null,
    [filtered, gameRows, selectedGameId],
  );

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

  const selectedInstitution = selectedGame?.institution || null;
  const selectedDevice = selectedGame?.device || null;
  const selectedManualCount = selectedGame?.players.filter((player) => player.playerSource === "manual").length || 0;
  const selectedRegisteredCount = selectedGame?.players.filter((player) => player.playerSource !== "manual").length || 0;
  const selectedSuccessfulTurns = selectedGame?.turns.filter((turn) => turn.success).length || 0;
  const selectedTurnSuccessRate = selectedGame && selectedGame.turns.length > 0 ? Math.round((selectedSuccessfulTurns / selectedGame.turns.length) * 100) : 0;
  const selectedRecentTurns = [...(selectedGame?.turns || [])].sort((a, b) => b.turnNumber - a.turnNumber).slice(0, 6);
  const accessSegments = [
    { key: "all" as const, label: "Todas", count: metrics.totalGames },
    { key: "owned" as const, label: "Mis dispositivos", count: metrics.ownedGames },
    { key: "institution" as const, label: "Institución visible", count: metrics.institutionVisibleGames },
    { key: "shared" as const, label: "Compartidas", count: gameRows.filter((game) => game.accessRelation === "compartido visible").length },
    { key: "unresolved" as const, label: "Sin asociación resuelta", count: metrics.unresolvedAssociations },
  ];

  function resolveTurnPlayerLabel(gameId: string, playerId?: string | null, externalPlayerUid?: string | null, studentId?: string | null) {
    const game = gameRows.find((item) => item.id === gameId);
    const player = game?.players.find((item) =>
      (playerId && item.id === playerId)
      || (externalPlayerUid && item.externalPlayerUid === externalPlayerUid)
      || (studentId && item.studentId === studentId),
    );

    return player?.playerName || player?.externalPlayerUid || player?.studentId || externalPlayerUid || studentId || playerId || "sin jugador enlazado";
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isFamilyView ? "Family" : isResearcherView ? "Researcher" : isTeacherView ? "Teacher" : isDirectorView ? "Director" : isInstitutionScopedView ? "Institution admin" : "Juego"}
        title="Partidas"
        description={
          isFamilyView
            ? "Vista simple de actividad visible, pensada para entender sesiones, participantes y ritmo general sin entrar en detalles técnicos de operación."
            : isResearcherView
            ? "Vista de evidencia sobre `game-data`, pensada para leer composición de muestra, asociaciones visibles y densidad de turnos sin mezclarlo con operación de aula."
            : isTeacherView
            ? "Vista de aula sobre partidas visibles para el docente, priorizando qué se jugó, con quién y desde qué dispositivo para poder conectar rápido actividad y contexto."
            : isDirectorView
            ? `Vista de seguimiento institucional de partidas para ${scopedInstitutionName || "la institución"}, pensada para leer volumen, mezcla de participantes y señales generales sin caer en detalle técnico innecesario.`
            : isInstitutionScopedView
            ? `Vista operativa de partidas para ${scopedInstitutionName}, ya alineada con el scope real de game-data por institución.`
            : "Vista operativa sobre `game-data` con contexto de institución, dispositivo, jugadores y desempeño, para seguir el tramo sync → partida sin caer en inspección cruda solamente."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por mazo, gameId, institución, dispositivo o jugador"
                className="pl-9"
              />
            </div>
            {isFamilyView ? null : (
              <>
                <select
                  value={institutionFilter || scopedInstitutionId || ""}
                  onChange={(event) => setInstitutionFilter(event.target.value)}
                  className="h-10 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
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
                  className="h-10 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos los modos</option>
                  <option value="registered">Solo registrados</option>
                  <option value="manual">Solo manuales</option>
                  <option value="mixed">Mixtos</option>
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
              <p className="text-sm font-medium text-foreground">Alcance operativo</p>
              <Badge variant={isFamilyView || isResearcherView || isTeacherView || isDirectorView || isInstitutionScopedView ? "secondary" : "outline"}>
                {isFamilyView ? "family" : isResearcherView ? "researcher" : isTeacherView ? "teacher" : isDirectorView ? "director" : isInstitutionScopedView ? "institution-admin" : "multi-institución / global"}
              </Badge>
              <Badge variant="outline">game-data real</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isFamilyView
                ? "La pantalla simplifica el lenguaje y deja la actividad visible en primer plano. Los cruces técnicos quedan en segundo plano para no sobrecargar la lectura."
                : isResearcherView
                ? "La vista conserva el alcance visible real y deja explícita la relación entre partida, dispositivo y composición de jugadores para poder leer evidencia sin irse directo al raw."
                : isTeacherView
                ? "La vista docente deja explícito por qué la partida entra en tu scope, qué dispositivo la sostiene y cómo se compone la sesión para conectar rápido juego y aula."
                : isDirectorView
                ? "La vista directoral deja en primer plano volumen, mezcla de participantes y contexto institucional para seguimiento general, sin pedirte leer turnos como si fuera una consola técnica."
                : isInstitutionScopedView
                ? "La tabla queda anclada a la institución visible por ACL, así que el filtro institucional pasa a ser informativo y no abre otras sedes."
                : "La vista refleja las partidas visibles según el alcance actual de game-data y permite cruzarlas con institución y dispositivo."}
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      {isResearcherView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Composición de muestra</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Leé rápido cuántas sesiones combinan manuales y registrados, y cómo queda representada la evidencia visible.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Asociaciones visibles</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">La relación entre partida, dispositivo y owner queda expuesta para evitar lecturas ambiguas del alcance.</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Turnos observables</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">La muestra destaca densidad de turnos, éxito visible y contexto de jugador sin caer directo en inspección cruda.</p>
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
        {gamesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={isFamilyView ? "Partidas" : isResearcherView ? "Muestra" : "Partidas"} value={String(metrics.totalGames)} hint={isFamilyView ? "Sesiones visibles dentro de esta cuenta." : isResearcherView ? "Sesiones visibles dentro de la muestra actual." : "Juegos visibles en la consulta actual."} icon={Gamepad2} />
            <SummaryCard label={isResearcherView ? "Participantes" : "Jugadores"} value={String(metrics.totalPlayers)} hint={isResearcherView ? "Volumen proyectado de participantes en la evidencia visible." : "Suma proyectada de participantes en la muestra."} icon={Users} />
            <SummaryCard label="Turnos" value={String(metrics.totalTurns)} hint={isFamilyView ? "Interacciones visibles dentro de las partidas." : isResearcherView ? "Eventos observables persistidos para análisis." : "Volumen operativo de interacción ya persistido."} icon={TimerReset} />
            <SummaryCard label={isFamilyView ? "Mazos" : isResearcherView ? "Muestra mixta" : "Mixtas"} value={String(isFamilyView ? new Set(games.map((game) => game.deckName).filter(Boolean)).size : metrics.mixedGames)} hint={isFamilyView ? "Variedad de contenidos que aparecen en la cuenta." : isResearcherView ? "Sesiones con combinación de manuales y registrados." : "Partidas con mezcla de jugadores manuales y registrados."} icon={BookOpen} />
            <SummaryCard label={isFamilyView ? "Éxito visible" : isResearcherView ? "Éxito visible" : "Éxito"} value={`${metrics.successRate}%`} hint={isFamilyView ? "Lectura agregada del desempeño visible." : isResearcherView ? "Tasa agregada de turnos exitosos dentro de la vista." : "Tasa agregada de turnos exitosos en la vista."} icon={Trophy} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{isFamilyView ? "Actividad visible" : isResearcherView ? "Muestra visible de partidas" : isTeacherView ? "Partidas visibles para aula" : isDirectorView ? "Partidas visibles para seguimiento" : "Listado operativo de partidas"}</CardTitle>
            <CardDescription>
              {isFamilyView
                ? "Seleccioná una partida para ver un resumen simple de participantes, turnos y momento de inicio."
                : isResearcherView
                ? "Seleccioná una partida para inspeccionar composición de muestra, turnos y contexto visible sin salir del dashboard."
                : isTeacherView
                ? "Seleccioná una partida para entender rápido dispositivo, participantes y ritmo visible antes de bajar a más detalle."
                : isDirectorView
                ? "Seleccioná una partida para revisar contexto institucional, volumen de participación y señales generales de seguimiento."
                : "Seleccioná una partida para inspeccionar mezcla de jugadores, turnos y contexto institucional sin salir del dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {gamesQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : gamesQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(gamesQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
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
                    filtered.map((game) => {
                      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
                      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

                      return (
                        <TableRow
                          key={game.id}
                          className={cn("cursor-pointer", selectedGameId === game.id && "bg-primary/5")}
                          onClick={() => setSelectedGameId(game.id)}
                        >
                          <TableCell className="font-medium">{game.gameId || "-"}</TableCell>
                          <TableCell>{game.deckName || "-"}</TableCell>
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

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{isFamilyView ? "Resumen de partida" : isResearcherView ? "Detalle de evidencia" : isTeacherView ? "Detalle para aula" : isDirectorView ? "Detalle de seguimiento" : "Detalle de partida"}</CardTitle>
            <CardDescription>
              {isFamilyView
                ? "Resumen simple de participantes, turnos y ritmo visible de la partida seleccionada."
                : isResearcherView
                ? "Resumen rápido de composición de muestra, asociaciones visibles y últimos turnos persistidos."
                : isTeacherView
                ? "Resumen rápido de dispositivo, composición de jugadores y ritmo visible para lectura docente."
                : isDirectorView
                ? "Resumen rápido de participación, contexto institucional y señales generales útiles para seguimiento."
                : "Resumen rápido de desempeño, composición de jugadores y últimos turnos persistidos."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedGame ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                {isFamilyView ? "Elegí una partida para revisar un resumen simple de actividad." : isResearcherView ? "Elegí una partida para revisar su detalle de evidencia." : isTeacherView ? "Elegí una partida para revisar su detalle de aula." : isDirectorView ? "Elegí una partida para revisar su detalle de seguimiento." : "Elegí una partida para revisar su detalle operativo."}
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedGame.deckName || `Game ${selectedGame.gameId || "-"}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Game ID {selectedGame.gameId || "-"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedInstitution?.name || "sin institución"}</Badge>
                      <Badge variant="outline">{selectedTurnSuccessRate}% éxito</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    {isFamilyView ? null : <p>Dispositivo: {selectedDevice?.name || selectedDevice?.deviceId || selectedGame.bleDeviceId || "-"}</p>}
                    {isFamilyView ? null : <p>Owner del dispositivo: {selectedGame.ownerLabel}</p>}
                    <p>Inicio: {formatDateTime(selectedGame.startDate)}</p>
                    {isFamilyView ? null : <p>Relación de acceso: {selectedGame.accessRelation}</p>}
                    <p>Jugadores: {selectedGame.players.length || selectedGame.totalPlayers || 0}</p>
                    <p>Turnos: {selectedGame.turns.length}</p>
                    <p>Registrados: {selectedRegisteredCount}</p>
                    <p>Manuales: {selectedManualCount}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Participantes visibles" : isResearcherView ? "Participantes y asociaciones visibles" : isTeacherView ? "Participantes y contexto de aula" : isDirectorView ? "Participantes y contexto institucional" : "Jugadores y asociaciones"}</p>
                  <div className="mt-3 space-y-3">
                    {selectedGame.players.length === 0 ? (
                      <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">Sin jugadores cargados.</div>
                    ) : (
                      selectedGame.players.map((player, index) => (
                        <div key={player.id || `${player.playerName}-${index}`} className="rounded-2xl bg-background/70 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{player.playerName || player.externalPlayerUid || `Jugador ${index + 1}`}</p>
                              <p className="text-xs text-muted-foreground">{player.studentId || player.externalPlayerUid || player.id || "sin id enlazado"}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={player.playerSource === "manual" ? "success" : "outline"}>{player.playerSource === "manual" ? "manual" : "registrado"}</Badge>
                              <Badge variant="outline">posición {player.position}</Badge>
                              {player.cardColor ? <Badge variant="outline">{player.cardColor}</Badge> : null}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Momentos recientes" : isResearcherView ? "Turnos observables" : isTeacherView ? "Ritmo visible" : isDirectorView ? "Turnos visibles para seguimiento" : "Últimos turnos"}</p>
                  <div className="mt-3 space-y-2">
                    {selectedRecentTurns.length === 0 ? (
                      <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">Sin turnos persistidos.</div>
                    ) : (
                      selectedRecentTurns.map((turn) => (
                        <div key={turn.id} className="rounded-2xl bg-background/70 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">Turno {turn.turnNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {resolveTurnPlayerLabel(selectedGame.id, turn.gamePlayerId, turn.externalPlayerUid, turn.studentId)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={turn.success ? "success" : "outline"}>{turn.success ? "éxito" : "fallo"}</Badge>
                              <Badge variant="outline">{turn.playTimeSeconds || 0}s</Badge>
                              {turn.difficulty ? <Badge variant="outline">{turn.difficulty}</Badge> : null}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <p>Inicio del turno: {formatDateTime(turn.turnStartDate)}</p>
                            <p>Card: {turn.cardId || "sin card"}</p>
                          </div>
                        </div>
                      ))
                    )}
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
