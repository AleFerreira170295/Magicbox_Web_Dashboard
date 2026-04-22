"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Database,
  Link2,
  Layers3,
  Sparkles,
  Smartphone,
  Users2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
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

function InsightRow({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4">
      <div className="rounded-2xl bg-accent p-2.5 text-accent-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/80 bg-card/95 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(31,42,55,0.08)]">
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-2xl bg-primary/12 p-3 text-primary">
              <Icon className="size-5" />
            </div>
            <Badge variant="outline">Docente</Badge>
          </div>
          <div className="mt-5">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="mt-auto pt-5 text-sm font-medium text-primary">Abrir módulo</div>
        </CardContent>
      </Card>
    </Link>
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
      devicesWithoutStatus: devices.filter((device) => !device.status).length,
      gamesWithoutTurns: games.filter((game) => game.turns.length === 0).length,
      syncsWithoutRaw: syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) === 0).length,
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

  const priorities = [
    {
      title: "Partidas sin turnos",
      value: metrics.gamesWithoutTurns,
      description: "Ayuda a detectar sesiones que se crean pero no terminan de arrancar en aula.",
      icon: Database,
    },
    {
      title: "Dispositivos sin status",
      value: metrics.devicesWithoutStatus,
      description: "Conviene revisar parque visible antes de la próxima clase o instancia de uso.",
      icon: Smartphone,
    },
    {
      title: "Syncs sin raw",
      value: metrics.syncsWithoutRaw,
      description: "Sirve como alerta temprana para trazabilidad incompleta o captura parcial.",
      icon: Layers3,
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Docente"
        title="Home operativa para acompañar el aula"
        description="La base visual puede seguir mejorando después, pero esta pantalla ya prioriza lo que una cuenta docente necesita ver para operar: partidas, dispositivos, sincronizaciones y señales concretas de revisión."
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#31465e_52%,#3f5a74_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Aprendizaje colaborativo</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Sin pantallas</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Datos accionables</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                La home docente ya no es solo una dirección visual, ahora también sirve para operar el día.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Ordena rápido la actividad visible, señala fricciones comunes y deja accesos directos a los módulos que una sesión docente realmente usa.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Visión general</p>
                <p className="mt-2 text-lg font-medium">Panorama rápido de juego, parque y sincronización reciente.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Operación cotidiana</p>
                <p className="mt-2 text-lg font-medium">Qué revisar antes de una clase o de una nueva ronda de uso.</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Próxima capa</p>
                <p className="mt-2 text-lg font-medium">Después podemos profundizar progreso por grupo y narrativa pedagógica.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué mirar hoy</CardTitle>
            <CardDescription>
              Señales concretas para ordenar la revisión diaria sin entrar todavía a cada módulo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorities.length > 0 ? (
              priorities.map((item) => (
                <InsightRow key={item.title} title={`${item.title}: ${item.value}`} description={item.description} icon={item.icon} />
              ))
            ) : (
              <>
                <InsightRow
                  title="Actividad reciente"
                  description="Ver si hubo nuevas partidas, sincronizaciones o dispositivos activos desde la última revisión."
                  icon={Sparkles}
                />
                <InsightRow
                  title="Participación del grupo"
                  description="Preparar una lectura más pedagógica sobre colaboración, progreso y tiempos de respuesta."
                  icon={Users2}
                />
                <InsightRow
                  title="Seguimiento por contenido"
                  description="Identificar qué mazos o desafíos están apareciendo más para ordenar el análisis didáctico."
                  icon={BookOpen}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <MetricCard
              label="Partidas visibles"
              value={String(metrics.totalGames)}
              hint="Lectura actual desde /game-data/, útil como primer termómetro del uso real."
              icon={Database}
            />
            <MetricCard
              label="Dispositivos visibles"
              value={String(metrics.totalDevices)}
              hint="Fuente base para el mapa operativo del parque MagicBox en circulación."
              icon={Smartphone}
            />
            <MetricCard
              label="Sincronizaciones visibles"
              value={String(metrics.totalSyncs)}
              hint="Sirve para validar el flujo actual mientras completamos la capa lossless."
              icon={Layers3}
            />
            <MetricCard
              label="Tiempo promedio por turno"
              value={formatDurationSeconds(metrics.avgTurnTime)}
              hint="Una señal temprana para detectar ritmo de juego y carga cognitiva."
              icon={Activity}
            />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte del dashboard: {getErrorMessage(error)}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Módulos principales</CardTitle>
          <CardDescription>
            Accesos rápidos a los frentes operativos que este perfil usa de verdad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-3">
            <ModuleCard href="/games" title="Partidas" description="Lectura del uso real, mazos activos y sesiones visibles." icon={Database} />
            <ModuleCard href="/devices" title="Dispositivos" description="Chequeo rápido del parque visible y de señales de hardware para el aula." icon={Smartphone} />
            <ModuleCard href="/syncs" title="Sincronizaciones" description="Validación del flujo reciente y trazabilidad básica de la captura." icon={Link2} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Partidas por mazo</CardTitle>
            <CardDescription>
              Un primer bloque de lectura curricular para ver qué materiales están teniendo más movimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : metrics.deckChart.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                Sin partidas para graficar todavía.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.deckChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e67e22" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Sincronizaciones por origen</CardTitle>
            <CardDescription>
              Este bloque después puede evolucionar a salud de sincronización y consistencia de captura.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : metrics.syncSourceChart.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                No hay sincronizaciones visibles todavía.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.syncSourceChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3f7d6b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Dirección visual sugerida para la siguiente iteración</CardTitle>
              <CardDescription>
                {user?.fullName || "La cuenta autenticada"} ya puede ver una base más alineada con la marca.
                Lo próximo sería profundizar la pantalla con progreso por grupo, alertas suaves y narrativa por estudiante.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Siguiente paso
              <ArrowRight className="size-4" />
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
