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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const effectiveInstitutionFilter = institutionFilter || scopedInstitutionId || "";

    return games.filter((game) => {
      if (effectiveInstitutionFilter && game.educationalCenterId !== effectiveInstitutionFilter) return false;

      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

      if (playerModeFilter === "manual" && !(manualCount > 0 && registeredCount === 0)) return false;
      if (playerModeFilter === "mixed" && !(manualCount > 0 && registeredCount > 0)) return false;
      if (playerModeFilter === "registered" && !(registeredCount > 0 && manualCount === 0)) return false;

      if (!normalized) return true;

      const institution = game.educationalCenterId ? institutionById.get(game.educationalCenterId) : null;
      const device = game.bleDeviceId ? deviceById.get(game.bleDeviceId) : null;

      return [
        game.deckName,
        game.gameId,
        game.bleDeviceId,
        institution?.name,
        device?.name,
        device?.deviceId,
        ...game.players.map((player) => player.playerName),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [deviceById, games, institutionById, institutionFilter, playerModeFilter, query, scopedInstitutionId]);

  const selectedGame = useMemo(
    () => filtered.find((game) => game.id === selectedGameId) || games.find((game) => game.id === selectedGameId) || null,
    [filtered, games, selectedGameId],
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
      successRate: totalTurns > 0 ? Math.round((successfulTurns / totalTurns) * 100) : 0,
    };
  }, [games]);

  const selectedInstitution = selectedGame?.educationalCenterId ? institutionById.get(selectedGame.educationalCenterId) : null;
  const selectedDevice = selectedGame?.bleDeviceId ? deviceById.get(selectedGame.bleDeviceId) : null;
  const selectedManualCount = selectedGame?.players.filter((player) => player.playerSource === "manual").length || 0;
  const selectedRegisteredCount = selectedGame?.players.filter((player) => player.playerSource !== "manual").length || 0;
  const selectedSuccessfulTurns = selectedGame?.turns.filter((turn) => turn.success).length || 0;
  const selectedTurnSuccessRate = selectedGame && selectedGame.turns.length > 0 ? Math.round((selectedSuccessfulTurns / selectedGame.turns.length) * 100) : 0;
  const selectedRecentTurns = [...(selectedGame?.turns || [])].sort((a, b) => b.turnNumber - a.turnNumber).slice(0, 6);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? "Institution admin" : "Juego"}
        title="Partidas"
        description={
          isInstitutionScopedView
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
          </div>
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Alcance operativo</p>
              <Badge variant={isInstitutionScopedView ? "secondary" : "outline"}>
                {isInstitutionScopedView ? "institution-admin" : "multi-institución / global"}
              </Badge>
              <Badge variant="outline">game-data real</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isInstitutionScopedView
                ? "La tabla queda anclada a la institución visible por ACL, así que el filtro institucional pasa a ser informativo y no abre otras sedes."
                : "La vista refleja las partidas visibles según el alcance actual de game-data y permite cruzarlas con institución y dispositivo."}
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {gamesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Partidas" value={String(metrics.totalGames)} hint="Juegos visibles en la consulta actual." icon={Gamepad2} />
            <SummaryCard label="Jugadores" value={String(metrics.totalPlayers)} hint="Suma proyectada de participantes en la muestra." icon={Users} />
            <SummaryCard label="Turnos" value={String(metrics.totalTurns)} hint="Volumen operativo de interacción ya persistido." icon={TimerReset} />
            <SummaryCard label="Mixtas" value={String(metrics.mixedGames)} hint="Partidas con mezcla de jugadores manuales y registrados." icon={BookOpen} />
            <SummaryCard label="Éxito" value={`${metrics.successRate}%`} hint="Tasa agregada de turnos exitosos en la vista." icon={Trophy} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Listado operativo de partidas</CardTitle>
            <CardDescription>
              Seleccioná una partida para inspeccionar mezcla de jugadores, turnos y contexto institucional sin salir del dashboard.
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
                    <TableHead>Institución</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Jugadores</TableHead>
                    <TableHead>Turnos</TableHead>
                    <TableHead>Inicio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No hay partidas para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((game) => {
                      const institution = game.educationalCenterId ? institutionById.get(game.educationalCenterId) : null;
                      const device = game.bleDeviceId ? deviceById.get(game.bleDeviceId) : null;
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
                          <TableCell>{institution?.name || game.educationalCenterId || "-"}</TableCell>
                          <TableCell>{device?.name || device?.deviceId || game.bleDeviceId || "-"}</TableCell>
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
            <CardTitle>Detalle de partida</CardTitle>
            <CardDescription>
              Resumen rápido de desempeño, composición de jugadores y últimos turnos persistidos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedGame ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí una partida para revisar su detalle operativo.
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
                    <p>Dispositivo: {selectedDevice?.name || selectedDevice?.deviceId || selectedGame.bleDeviceId || "-"}</p>
                    <p>Inicio: {formatDateTime(selectedGame.startDate)}</p>
                    <p>Jugadores: {selectedGame.players.length || selectedGame.totalPlayers || 0}</p>
                    <p>Turnos: {selectedGame.turns.length}</p>
                    <p>Registrados: {selectedRegisteredCount}</p>
                    <p>Manuales: {selectedManualCount}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Jugadores</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedGame.players.length === 0 ? (
                      <Badge variant="outline">sin jugadores cargados</Badge>
                    ) : (
                      selectedGame.players.map((player, index) => (
                        <Badge key={player.id || `${player.playerName}-${index}`} variant={player.playerSource === "manual" ? "success" : "outline"}>
                          {player.playerName || player.externalPlayerUid || `Jugador ${index + 1}`}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Últimos turnos</p>
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
                                {turn.externalPlayerUid || turn.gamePlayerId || turn.studentId || "sin jugador enlazado"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={turn.success ? "success" : "outline"}>{turn.success ? "éxito" : "fallo"}</Badge>
                              <Badge variant="outline">{turn.playTimeSeconds || 0}s</Badge>
                            </div>
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
