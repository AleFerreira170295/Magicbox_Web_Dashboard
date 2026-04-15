"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useGames } from "@/features/games/api";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

export function GamesTable() {
  const { tokens } = useAuth();
  const [query, setQuery] = useState("");
  const gamesQuery = useGames(tokens?.accessToken);

  const filtered = useMemo(() => {
    const games = gamesQuery.data?.data || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return games;
    return games.filter((game) =>
      [game.deckName, game.bleDeviceId, game.gameId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [gamesQuery.data?.data, query]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Exploración"
        title="Partidas"
        description="Vista base sobre `game-data`, incluyendo partidas con jugadores registrados, manuales o mixtos. En la siguiente fase se enriquecerá con vínculo a raw payloads, contexto pedagógico y reconstrucción lossless completa."
        actions={<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por mazo, gameId o dispositivo" className="w-80" />}
      />

      <Card>
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
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Jugadores</TableHead>
                  <TableHead>Turnos</TableHead>
                  <TableHead>Inicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay partidas para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((game) => (
                    (() => {
                      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;
                      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;

                      return (
                        <TableRow key={game.id}>
                          <TableCell className="font-medium">{game.gameId || "-"}</TableCell>
                          <TableCell>{game.deckName || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{game.bleDeviceId || "-"}</TableCell>
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
                    })()
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
