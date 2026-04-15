"use client";

import { useMemo } from "react";
import { Activity, Database, Layers3, Smartphone } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/section-header";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { useSyncSessions } from "@/features/syncs/api";
import { getErrorMessage, formatDurationSeconds } from "@/lib/utils";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TeacherDashboard() {
  const { tokens, user } = useAuth();
  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const isLoading = gamesQuery.isLoading || devicesQuery.isLoading || syncsQuery.isLoading;
  const error = gamesQuery.error || devicesQuery.error || syncsQuery.error;

  const metrics = useMemo(() => {
    const games = gamesQuery.data?.data || [];
    const devices = devicesQuery.data?.data || [];
    const syncs = syncsQuery.data?.data || [];
    const totalTurns = games.reduce((sum, game) => sum + game.turns.length, 0);
    const totalTurnTime = games.reduce(
      (sum, game) => sum + game.turns.reduce((turnSum, turn) => turnSum + (turn.playTimeSeconds || 0), 0),
      0,
    );
    const avgTurnTime = totalTurns > 0 ? totalTurnTime / totalTurns : 0;

    return {
      totalGames: gamesQuery.data?.total || games.length,
      totalDevices: devicesQuery.data?.total || devices.length,
      totalSyncs: syncsQuery.data?.total || syncs.length,
      avgTurnTime,
      deckChart: Object.entries(
        games.reduce<Record<string, number>>((acc, game) => {
          const key = game.deckName || "Sin mazo";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
      syncSourceChart: Object.entries(
        syncs.reduce<Record<string, number>>((acc, sync) => {
          const key = sync.source || sync.sourceType || "desconocido";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, total]) => ({ name, total })),
    };
  }, [devicesQuery.data, gamesQuery.data, syncsQuery.data]);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Docente"
        title="Dashboard inicial"
        description="Base operativa para visualizar partidas, dispositivos y sincronizaciones. Mientras el backend lossless se completa, esta vista combina endpoints existentes y contratos preparados para la siguiente fase."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)
        ) : (
          <>
            <MetricCard label="Partidas visibles" value={String(metrics.totalGames)} hint="Lectura desde /game-data/" icon={Database} />
            <MetricCard label="Dispositivos visibles" value={String(metrics.totalDevices)} hint="Lectura desde /ble-device" icon={Smartphone} />
            <MetricCard label="Sincronizaciones visibles" value={String(metrics.totalSyncs)} hint="Lee endpoint canónico o fallback legacy" icon={Layers3} />
            <MetricCard label="Tiempo promedio por turno" value={formatDurationSeconds(metrics.avgTurnTime)} hint="Derivado del dataset visible actual" icon={Activity} />
          </>
        )}
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Partidas por mazo</CardTitle>
            <CardDescription>Distribución sobre las partidas visibles en esta primera iteración.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : metrics.deckChart.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Sin partidas para graficar todavía.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.deckChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sincronizaciones por origen</CardTitle>
            <CardDescription>Sirve para validar la mezcla de fuentes y preparar monitoreo de calidad de sync.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : metrics.syncSourceChart.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                No hay sincronizaciones visibles todavía.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.syncSourceChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0f766e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado del diseño de datos</CardTitle>
          <CardDescription>
            {user?.fullName || "La cuenta autenticada"} ya puede navegar datos operativos actuales. La siguiente fase es completar la ingestión raw lossless y exponer roles/permisos explícitos desde backend.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
