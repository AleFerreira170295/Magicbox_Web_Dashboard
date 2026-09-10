"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Target, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPlayerOutcomeSeries, buildRoundOutcomeSeries } from "@/features/device-import/game-analytics";
import type { ImportedGame } from "@/features/device-import/types";

const COLOR_LABELS: Record<string, string> = { AM: "Amarillo", NA: "Naranja", VE: "Verde", VI: "Violeta", CI: "Celeste", MA: "Rojo" };

export function ImportedGameCharts({ game }: { game: ImportedGame }) {
  const rounds = useMemo(() => buildRoundOutcomeSeries(game), [game]);
  const players = useMemo(() => buildPlayerOutcomeSeries(game), [game]);
  const hits = game.turns.filter((turn) => turn.correct).length;
  const misses = game.turns.length - hits;
  const accuracy = game.turns.length > 0 ? Math.round((hits / game.turns.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="size-5" />Rondas y aciertos</CardTitle>
        <CardDescription>Detalle visual de los resultados de la partida antes de subirla a la cuenta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-muted/40 p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rondas</p><p className="mt-2 text-2xl font-semibold">{rounds.length}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Aciertos</p><p className="mt-2 text-2xl font-semibold text-emerald-700">{hits}</p></div>
          <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs uppercase tracking-[0.18em] text-red-700">Errores</p><p className="mt-2 text-2xl font-semibold text-red-700">{misses}</p></div>
          <div className="rounded-2xl bg-primary/10 p-4"><p className="text-xs uppercase tracking-[0.18em] text-primary">Precisión</p><p className="mt-2 text-2xl font-semibold text-primary">{accuracy}%</p></div>
        </div>

        {rounds.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Esta partida terminó sin rondas jugadas.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <div className="mb-4"><p className="font-medium">Resultados por ronda</p><p className="text-sm text-muted-foreground">Compara aciertos y errores en cada ronda.</p></div>
              <div className="h-72 min-w-0" data-testid="import-round-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rounds} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="hits" name="Aciertos" fill="#16a34a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="misses" name="Errores" fill="#dc2626" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {rounds.map((round) => <Badge key={round.round} variant="outline"><TimerReset className="mr-1 size-3" />R{round.round}: {round.accuracy}% · {round.averageTimeSeconds}s</Badge>)}
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="mb-4"><p className="font-medium">Rendimiento por jugador</p><p className="text-sm text-muted-foreground">Muestra los aciertos de cada persona o color.</p></div>
              <div className="h-72 min-w-0" data-testid="import-player-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={players} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="hits" name="Aciertos" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="misses" name="Errores" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {players.map((player) => <Badge key={player.playerUid} variant="outline"><Target className="mr-1 size-3" />{player.label} · {COLOR_LABELS[player.colorCode] || player.colorCode}: {player.accuracy}%</Badge>)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
