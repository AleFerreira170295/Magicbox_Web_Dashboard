"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, BarChart3, Building2, Clock3, Gamepad2, Router, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { buildGameDetailHref, buildGamesOverviewHref, type GamesOverviewRouteState } from "@/features/games/game-route";
import { buildGameRows, buildSyncRelationHref, buildTurnOutcomeSeries, resolveTurnPlayerLabel } from "@/features/games/game-view";
import { useInstitutions } from "@/features/institutions/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

export function GameDetailPage({
  gameRecordId,
  overviewState,
}: {
  gameRecordId?: string | null;
  overviewState: GamesOverviewRouteState;
}) {
  const { tokens, user: currentUser } = useAuth();

  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data ?? [], [gamesQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data ?? [], [devicesQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const gameRows = useMemo(() => buildGameRows(games, devices, institutions, currentUser), [currentUser, devices, games, institutions]);

  const selectedGame = useMemo(() => {
    if (!gameRecordId) return null;
    return gameRows.find((game) => game.id === gameRecordId) ?? null;
  }, [gameRecordId, gameRows]);

  const sameDeviceGames = useMemo(() => {
    if (!selectedGame?.bleDeviceId) return [];
    return gameRows.filter((game) => game.id !== selectedGame.id && game.bleDeviceId === selectedGame.bleDeviceId);
  }, [gameRows, selectedGame]);

  const sameInstitutionGames = useMemo(() => {
    if (!selectedGame?.educationalCenterId) return [];
    return gameRows.filter((game) => game.id !== selectedGame.id && game.educationalCenterId === selectedGame.educationalCenterId && game.bleDeviceId !== selectedGame.bleDeviceId);
  }, [gameRows, selectedGame]);

  const turnOutcomeSeries = useMemo(() => buildTurnOutcomeSeries(selectedGame?.turns ?? []), [selectedGame?.turns]);
  const turnsPagination = useListPagination(selectedGame?.turns ?? [], 10, 1);
  const participantsPagination = useListPagination(selectedGame?.players ?? [], 10, 1);
  const sameDevicePagination = useListPagination(sameDeviceGames, 10, 1);
  const institutionPagination = useListPagination(sameInstitutionGames, 10, 1);

  const backHref = buildGamesOverviewHref(overviewState);
  const isLoading = gamesQuery.isLoading || devicesQuery.isLoading || institutionsQuery.isLoading;
  const hasFatalError = gamesQuery.error || devicesQuery.error || institutionsQuery.error;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Games · detalle"
        title={selectedGame?.deckName || (selectedGame?.gameId ? `Partida ${selectedGame.gameId}` : "Detalle de partida")}
        description={selectedGame
          ? "Pantalla dedicada para revisar contexto, navegación relacionada y rendimiento turno a turno sin depender del panel lateral del listado."
          : "Entrá desde Games para abrir el detalle dedicado de una partida."}
        actions={
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft className="size-4" />
            Volver a Games
          </Link>
        }
      />

      {!gameRecordId ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Falta contexto para abrir esta partida. Volvé a Games y entrá nuevamente desde una fila del listado.
          </CardContent>
        </Card>
      ) : hasFatalError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-destructive">
            No pude preparar la vista de la partida. {getErrorMessage(hasFatalError)}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-[28px]" />
          <Skeleton className="h-80 rounded-[28px]" />
        </div>
      ) : !selectedGame ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No encontré la partida solicitada dentro del alcance visible actual.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl border border-border/70 bg-primary/10 font-semibold text-primary">
                    <Gamepad2 className="size-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">{selectedGame.deckName || `Partida ${selectedGame.gameId || "-"}`}</h2>
                      <Badge variant="outline">Game ID {selectedGame.gameId || "-"}</Badge>
                      <Badge variant={selectedGame.hasUnresolvedAssociation ? "warning" : "success"}>{selectedGame.hasUnresolvedAssociation ? "revisar asociación" : "asociación resuelta"}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedGame.institution?.name ? <Badge variant="outline"><Building2 className="mr-1 size-3" />{selectedGame.institution.name}</Badge> : null}
                      <Badge variant="outline"><Router className="mr-1 size-3" />{selectedGame.device?.name || selectedGame.device?.deviceId || selectedGame.bleDeviceId || "sin dispositivo"}</Badge>
                      <Badge variant="outline">{selectedGame.accessRelation}</Badge>
                      <Badge variant="outline">owner {selectedGame.ownerLabel}</Badge>
                      <Badge variant="outline">inicio {formatDateTime(selectedGame.startDate)}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      Esta vista deja la partida en primer plano y mantiene a mano la navegación hacia otras sesiones relacionadas del mismo dispositivo o de la misma institución.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Jugadores</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedGame.playerCount}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Turnos</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedGame.turns.length}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Aciertos</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedGame.turns.filter((turn) => turn.success).length}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Errores</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedGame.turns.filter((turn) => !turn.success).length}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mix</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedGame.playerMixLabel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="size-5 text-primary" />
                  Contexto y navegación
                </CardTitle>
                <CardDescription>
                  Podés saltar a partidas relacionadas sin volver al listado general y manteniendo el contexto de acceso actual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cruces rápidos</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={buildSyncRelationHref(selectedGame)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Ver syncs del dispositivo
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mismo dispositivo</p>
                      <p className="mt-1 text-sm text-muted-foreground">Partidas visibles que salieron del mismo equipo.</p>
                    </div>
                    <ListPaginationControls
                      pageSize={sameDevicePagination.pageSize}
                      setPageSize={sameDevicePagination.setPageSize}
                      currentPage={sameDevicePagination.currentPage}
                      totalPages={sameDevicePagination.totalPages}
                      totalItems={sameDevicePagination.totalItems}
                      paginationStart={sameDevicePagination.paginationStart}
                      paginationEnd={sameDevicePagination.paginationEnd}
                      goToPreviousPage={sameDevicePagination.goToPreviousPage}
                      goToNextPage={sameDevicePagination.goToNextPage}
                    />
                  </div>
                  <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                    {sameDevicePagination.totalItems === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">No hay otras partidas visibles desde este dispositivo.</div>
                    ) : (
                      sameDevicePagination.paginatedItems.map((game) => (
                        <Link key={game.id} href={buildGameDetailHref({ gameRecordId: game.id, ...overviewState })} className="block rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{game.deckName || `Partida ${game.gameId || "-"}`}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Game ID {game.gameId || "-"} · {formatDateTime(game.startDate)}</p>
                            </div>
                            <Badge variant="outline">{game.turns.length} turnos</Badge>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Misma institución</p>
                      <p className="mt-1 text-sm text-muted-foreground">Otras partidas visibles dentro del mismo centro.</p>
                    </div>
                    <ListPaginationControls
                      pageSize={institutionPagination.pageSize}
                      setPageSize={institutionPagination.setPageSize}
                      currentPage={institutionPagination.currentPage}
                      totalPages={institutionPagination.totalPages}
                      totalItems={institutionPagination.totalItems}
                      paginationStart={institutionPagination.paginationStart}
                      paginationEnd={institutionPagination.paginationEnd}
                      goToPreviousPage={institutionPagination.goToPreviousPage}
                      goToNextPage={institutionPagination.goToNextPage}
                    />
                  </div>
                  <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                    {institutionPagination.totalItems === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">No hay otras partidas visibles dentro de esta institución.</div>
                    ) : (
                      institutionPagination.paginatedItems.map((game) => (
                        <Link key={game.id} href={buildGameDetailHref({ gameRecordId: game.id, ...overviewState })} className="block rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{game.deckName || `Partida ${game.gameId || "-"}`}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{game.device?.name || game.device?.deviceId || "sin dispositivo"}</p>
                            </div>
                            <Badge variant="outline">{game.playerCount} jugadores</Badge>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="size-5 text-primary" />
                  Aciertos y errores por turno
                </CardTitle>
                <CardDescription>
                  Cada barra muestra si ese turno terminó en acierto o error, en el orden real de la partida.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {turnOutcomeSeries.length === 0 ? (
                  <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">Sin turnos persistidos para graficar.</div>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={turnOutcomeSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={20} />
                        <YAxis allowDecimals={false} domain={[0, 1]} />
                        <Tooltip />
                        <Bar dataKey="aciertos" fill="#16a34a" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="errores" fill="#dc2626" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock3 className="size-5 text-primary" />
                  Turnos y participantes
                </CardTitle>
                <CardDescription>
                  El detalle queda paginado para recorrer la partida sin perder legibilidad cuando crece la cantidad de eventos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Participantes</p>
                    <ListPaginationControls
                      pageSize={participantsPagination.pageSize}
                      setPageSize={participantsPagination.setPageSize}
                      currentPage={participantsPagination.currentPage}
                      totalPages={participantsPagination.totalPages}
                      totalItems={participantsPagination.totalItems}
                      paginationStart={participantsPagination.paginationStart}
                      paginationEnd={participantsPagination.paginationEnd}
                      goToPreviousPage={participantsPagination.goToPreviousPage}
                      goToNextPage={participantsPagination.goToNextPage}
                    />
                  </div>
                  <div className="space-y-3">
                    {participantsPagination.totalItems === 0 ? (
                      <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">Sin jugadores cargados.</div>
                    ) : (
                      participantsPagination.paginatedItems.map((player, index) => (
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Turnos</p>
                    <ListPaginationControls
                      pageSize={turnsPagination.pageSize}
                      setPageSize={turnsPagination.setPageSize}
                      currentPage={turnsPagination.currentPage}
                      totalPages={turnsPagination.totalPages}
                      totalItems={turnsPagination.totalItems}
                      paginationStart={turnsPagination.paginationStart}
                      paginationEnd={turnsPagination.paginationEnd}
                      goToPreviousPage={turnsPagination.goToPreviousPage}
                      goToNextPage={turnsPagination.goToNextPage}
                    />
                  </div>
                  <div className="space-y-2">
                    {turnsPagination.totalItems === 0 ? (
                      <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">Sin turnos persistidos.</div>
                    ) : (
                      turnsPagination.paginatedItems.map((turn) => (
                        <div key={turn.id} className="rounded-2xl bg-background/70 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">Turno {turn.turnNumber}</p>
                              <p className="text-xs text-muted-foreground">{resolveTurnPlayerLabel(selectedGame, turn.gamePlayerId, turn.externalPlayerUid, turn.studentId)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={turn.success ? "success" : "outline"}>{turn.success ? "acierto" : "error"}</Badge>
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
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
