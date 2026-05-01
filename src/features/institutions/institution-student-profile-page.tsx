"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, GraduationCap, Search, UserRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { hasAnyUserPermission } from "@/features/auth/permission-contract";
import { useClassGroups } from "@/features/class-groups/api";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
import { deleteStudent, useAllStudents } from "@/features/students/api";
import { buildInstitutionStudentDetailHref, buildInstitutionsOverviewHref } from "@/features/institutions/student-route";
import { cn, formatDateTime, formatDurationSeconds, getErrorMessage } from "@/lib/utils";

type AnalyticsScope = "group" | "student";

function getPersonInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "ST";
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function getDateBucketLabel(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function InstitutionStudentProfilePage({
  institutionId,
  groupId,
  studentId,
}: {
  institutionId?: string | null;
  groupId?: string | null;
  studentId?: string | null;
}) {
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [analyticsScope, setAnalyticsScope] = useState<AnalyticsScope>("student");
  const [studentGamesSearchQuery, setStudentGamesSearchQuery] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const classGroupsQuery = useClassGroups(tokens?.accessToken, institutionId ?? null);
  const studentsQuery = useAllStudents(tokens?.accessToken, {
    institutionId: institutionId ?? null,
    classGroupId: groupId ?? null,
    sortBy: "updated_at",
    order: "desc",
  });
  const gamesQuery = useGames(tokens?.accessToken, {
    institutionId: institutionId ?? null,
    page: 1,
    limit: 100,
    sortBy: "created_at",
    order: "desc",
  });

  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const groups = useMemo(() => classGroupsQuery.data?.data ?? [], [classGroupsQuery.data?.data]);
  const students = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data ?? [], [gamesQuery.data?.data]);

  const selectedInstitution = useMemo(() => institutions.find((institution) => institution.id === institutionId) ?? null, [institutionId, institutions]);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId) ?? null, [groupId, groups]);
  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId) ?? null, [studentId, students]);

  const studentPerformanceRows = useMemo(() => {
    return students.map((student) => {
      const studentGames = games.filter((game) => game.players.some((player) => player.studentId === student.id) || game.turns.some((turn) => turn.studentId === student.id));
      const turns = studentGames.flatMap((game) => game.turns.filter((turn) => turn.studentId === student.id));
      const successfulTurns = turns.filter((turn) => turn.success).length;
      const totalTurnSeconds = turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
      const lastParticipation = studentGames
        .map((game) => game.startDate || game.updatedAt || game.createdAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;

      return {
        student,
        games: studentGames,
        gamesCount: studentGames.length,
        turnsCount: turns.length,
        successRate: turns.length > 0 ? Math.round((successfulTurns / turns.length) * 100) : 0,
        averageTurnSeconds: turns.length > 0 ? totalTurnSeconds / turns.length : 0,
        lastParticipation,
      };
    });
  }, [games, students]);

  const selectedStudentPerformance = useMemo(
    () => studentPerformanceRows.find((entry) => entry.student.id === selectedStudent?.id) ?? null,
    [selectedStudent?.id, studentPerformanceRows],
  );

  const selectedGroupStudentIds = useMemo(() => new Set(students.map((student) => student.id)), [students]);

  const analyticsSeries = useMemo(() => {
    const aggregation = new Map<string, { name: string; games: number; turns: number; successfulTurns: number; sortValue: number }>();

    for (const game of games) {
      const relevantTurns = analyticsScope === "student"
        ? game.turns.filter((turn) => turn.studentId === selectedStudent?.id)
        : game.turns.filter((turn) => turn.studentId && selectedGroupStudentIds.has(turn.studentId));

      const hasRelevantPlayers = analyticsScope === "student"
        ? game.players.some((player) => player.studentId === selectedStudent?.id)
        : game.players.some((player) => player.studentId && selectedGroupStudentIds.has(player.studentId));

      if (!hasRelevantPlayers && relevantTurns.length === 0) continue;

      const bucketSource = game.startDate || game.createdAt || game.updatedAt || relevantTurns[0]?.turnStartDate || relevantTurns[0]?.createdAt || null;
      const bucketDate = bucketSource ? new Date(bucketSource) : null;
      const bucketKey = bucketDate && !Number.isNaN(bucketDate.getTime()) ? bucketDate.toISOString().slice(0, 10) : game.id;
      const bucket = aggregation.get(bucketKey) ?? {
        name: getDateBucketLabel(bucketSource),
        games: 0,
        turns: 0,
        successfulTurns: 0,
        sortValue: bucketDate && !Number.isNaN(bucketDate.getTime()) ? bucketDate.getTime() : 0,
      };

      bucket.games += 1;
      bucket.turns += relevantTurns.length;
      bucket.successfulTurns += relevantTurns.filter((turn) => turn.success).length;
      aggregation.set(bucketKey, bucket);
    }

    return [...aggregation.values()]
      .sort((a, b) => a.sortValue - b.sortValue)
      .map((entry) => ({
        name: entry.name,
        partidas: entry.games,
        turnos: entry.turns,
        acierto: entry.turns > 0 ? Math.round((entry.successfulTurns / entry.turns) * 100) : 0,
      }));
  }, [analyticsScope, games, selectedGroupStudentIds, selectedStudent?.id]);

  const analyticsTitle = analyticsScope === "student"
    ? selectedStudent?.fullName || "estudiante seleccionado"
    : selectedGroup?.name || "grupo seleccionado";

  const analyticsDescription = analyticsScope === "student"
    ? "La lectura temporal usa solo las partidas y turnos del estudiante activo."
    : "La lectura temporal consolida las partidas y turnos de todo el grupo.";

  const selectedStudentGameRows = useMemo(
    () => (selectedStudentPerformance?.games ?? []).map((game) => {
      const turns = game.turns.filter((turn) => turn.studentId === selectedStudent?.id);
      const successfulTurns = turns.filter((turn) => turn.success).length;
      const avgTurnSeconds = turns.length > 0
        ? turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0) / turns.length
        : 0;

      return {
        id: game.id,
        label: `${game.deckName || "Partida"} #${game.gameId || "-"}`,
        playedAt: game.startDate || game.updatedAt || game.createdAt || null,
        turnCount: turns.length,
        successRate: turns.length > 0 ? Math.round((successfulTurns / turns.length) * 100) : 0,
        avgTurnSeconds,
      };
    }),
    [selectedStudent?.id, selectedStudentPerformance?.games],
  );

  const filteredSelectedStudentGameRows = useMemo(() => {
    const normalizedSearch = studentGamesSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return selectedStudentGameRows;

    return selectedStudentGameRows.filter((game) => [game.label, game.playedAt].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch)));
  }, [selectedStudentGameRows, studentGamesSearchQuery]);

  const backHref = buildInstitutionsOverviewHref({ institutionId, groupId });
  const navigationStudents = useMemo(() => {
    const currentEntry = studentPerformanceRows.find((entry) => entry.student.id === selectedStudent?.id) ?? null;
    const otherEntries = studentPerformanceRows.filter((entry) => entry.student.id !== selectedStudent?.id);
    return currentEntry ? [currentEntry, ...otherEntries] : otherEntries;
  }, [selectedStudent?.id, studentPerformanceRows]);
  const selectedStudentStatus = (selectedStudentPerformance?.gamesCount ?? 0) > 0 ? "Con actividad" : "Sin partidas registradas";
  const selectedStudentStatusVariant = (selectedStudentPerformance?.gamesCount ?? 0) > 0 ? "success" : "outline";
  const selectedStudentLastParticipationLabel = selectedStudentPerformance?.lastParticipation
    ? formatDateTime(selectedStudentPerformance.lastParticipation)
    : "Todavía sin participación registrada";
  const selectedStudentVisibleTurns = selectedStudentGameRows.reduce((sum, game) => sum + game.turnCount, 0);

  const missingRequiredIds = !institutionId || !groupId || !studentId;
  const isLoadingData = institutionsQuery.isLoading || classGroupsQuery.isLoading || studentsQuery.isLoading || gamesQuery.isLoading;
  const hasFatalError = institutionsQuery.error || classGroupsQuery.error || studentsQuery.error || gamesQuery.error;
  const canDeleteStudent = hasAnyUserPermission(currentUser, "student:delete");

  const deleteStudentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent || !tokens?.accessToken) throw new Error("No hay estudiante seleccionado.");
      await deleteStudent(tokens.accessToken, selectedStudent.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["class-groups"] }),
      ]);
      setIsDeleteDialogOpen(false);
      router.push(backHref);
    },
  });

  async function handleDeleteCurrentStudent() {
    if (!canDeleteStudent) return;
    await deleteStudentMutation.mutateAsync();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Institutions · detalle interno"
        title={selectedStudent ? selectedStudent.fullName : "Detalle por estudiante"}
        description={selectedStudent
          ? `Vista interna del alumno dentro de ${selectedGroup?.name || "su grupo"}, con analítica temporal, métricas y partidas registradas.`
          : "Entrá a un estudiante desde Institutions para revisar su información y comportamiento de juego en una pantalla dedicada."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedStudent && canDeleteStudent ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className={cn(buttonVariants({ variant: "destructive" }))}
                disabled={deleteStudentMutation.isPending}
              >
                Eliminar estudiante
              </button>
            ) : null}
            <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
              <ArrowLeft className="size-4" />
              Volver a Institutions
            </Link>
          </div>
        }
      />

      {missingRequiredIds ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Falta contexto para abrir este detalle. Volvé a Institutions y entrá nuevamente desde la fila del estudiante.
          </CardContent>
        </Card>
      ) : hasFatalError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-destructive">
            No pude preparar la vista del estudiante. {getErrorMessage(hasFatalError)}
          </CardContent>
        </Card>
      ) : isLoadingData ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-[28px]" />
          <Skeleton className="h-72 rounded-[28px]" />
          <Skeleton className="h-72 rounded-[28px]" />
        </div>
      ) : !selectedStudent ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No encontré el estudiante solicitado dentro del grupo actual. Puede haber cambiado el grupo, el filtro base o la carga de datos.
          </CardContent>
        </Card>
      ) : (
        <>
          {deleteStudentMutation.error ? (
            <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-6 text-sm text-destructive">
                No pude eliminar el estudiante. {getErrorMessage(deleteStudentMutation.error)}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-primary/10 font-semibold text-primary">
                    {selectedStudent.imageUrl ? (
                      <img src={selectedStudent.imageUrl} alt={selectedStudent.fullName} className="h-full w-full object-cover" />
                    ) : (
                      <span>{getPersonInitials(selectedStudent.fullName)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">{selectedStudent.fullName}</h2>
                      <Badge variant="secondary">Perfil de jugador</Badge>
                      <Badge variant={selectedStudentStatusVariant}>{selectedStudentStatus}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">Documento / ID: {selectedStudent.fileNumber || "-"}</Badge>
                      {selectedGroup ? <Badge variant="outline"><GraduationCap className="mr-1 size-3" />{selectedGroup.name}</Badge> : null}
                      {selectedInstitution ? <Badge variant="outline"><Building2 className="mr-1 size-3" />{selectedInstitution.name}</Badge> : null}
                      {selectedStudent.updatedAt ? <Badge variant="outline">act. {formatDateTime(selectedStudent.updatedAt)}</Badge> : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      Esta vista concentra el contexto del alumno, su evolución temporal y el historial de partidas en una pantalla estable, sin overlays ni paneles laterales.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Partidas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentPerformance?.gamesCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Turnos</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentPerformance?.turnsCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Acierto</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentPerformance?.successRate ?? 0}%</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tiempo medio</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatDurationSeconds(selectedStudentPerformance?.averageTurnSeconds ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Última participación</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedStudentLastParticipationLabel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="size-5 text-primary" />
                  Contexto y navegación
                </CardTitle>
                <CardDescription>
                  Ves todos los perfiles del grupo en un único bloque con scroll, y podés saltar entre ellos sin volver a la pantalla principal.
                </CardDescription>
              </CardHeader>
              <CardContent
                data-testid="institution-student-navigation-list"
                className="grid max-h-[min(70vh,640px)] gap-3 overflow-y-auto overscroll-contain pr-1"
              >
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Grupo activo</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{selectedGroup?.name || "Grupo sin nombre"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {students.length} perfiles en el grupo · {selectedInstitution?.name || "Institución sin identificar"}
                  </p>
                </div>

                {navigationStudents.length > 0 ? navigationStudents.map((entry) => {
                  const isCurrentStudent = entry.student.id === selectedStudent?.id;

                  if (isCurrentStudent) {
                    return (
                      <div
                        key={entry.student.id}
                        className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{entry.student.fullName}</p>
                              <Badge variant="secondary">actual</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Documento / ID: {entry.student.fileNumber || "-"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Perfil abierto en esta pantalla</p>
                          </div>
                          <Badge variant="outline">{entry.gamesCount} partidas</Badge>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={entry.student.id}
                      href={buildInstitutionStudentDetailHref({
                        institutionId: institutionId as string,
                        groupId: groupId as string,
                        studentId: entry.student.id,
                      })}
                      className="rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.student.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Documento / ID: {entry.student.fileNumber || "-"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Ver perfil completo del estudiante</p>
                        </div>
                        <Badge variant="outline">{entry.gamesCount} partidas</Badge>
                      </div>
                    </Link>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                    No hay estudiantes cargados en este grupo por ahora.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Analítica temporal</CardTitle>
                  <CardDescription>
                    {analyticsTitle}: {analyticsDescription}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={analyticsScope === "group" ? "secondary" : "outline"} onClick={() => setAnalyticsScope("group")}>
                    Ver grupo
                  </Button>
                  <Button type="button" size="sm" variant={analyticsScope === "student" ? "secondary" : "outline"} onClick={() => setAnalyticsScope("student")}>
                    Ver estudiante
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Turnos por fecha</p>
                <p className="mt-1 text-sm text-muted-foreground">Cantidad de turnos registrados a lo largo del tiempo.</p>
                <div className="mt-4 h-60">
                  {analyticsSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={30} />
                        <Tooltip />
                        <Bar dataKey="turnos" fill="#47b9ef" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                      Todavía no hay turnos cargados para graficar.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Partidas por fecha</p>
                <p className="mt-1 text-sm text-muted-foreground">Permite ver la frecuencia de uso por día.</p>
                <div className="mt-4 h-60">
                  {analyticsSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={30} />
                        <Tooltip />
                        <Bar dataKey="partidas" fill="#1f2a37" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                      Todavía no hay partidas cargadas para graficar.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-sm font-medium text-foreground">Porcentaje de acierto</p>
                <p className="mt-1 text-sm text-muted-foreground">Evolución de aciertos según el período visible.</p>
                <div className="mt-4 h-60">
                  {analyticsSeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} width={30} />
                        <Tooltip />
                        <Bar dataKey="acierto" fill="#6d5efc" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                      Todavía no hay porcentaje de acierto para graficar.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Partidas en las que participó</CardTitle>
              <CardDescription>
                Listado operativo para ver cuándo jugó, cuántos turnos tuvo y cómo rindió en cada partida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Partidas registradas</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{filteredSelectedStudentGameRows.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Sobre {selectedStudentGameRows.length} partidas asociadas al estudiante.</p>
                </div>
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Turnos acumulados</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentVisibleTurns}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Suma de turnos registrados en las partidas listadas.</p>
                </div>
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Última participación</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{selectedStudentLastParticipationLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Te ayuda a leer recencia sin salir de esta vista.</p>
                </div>
              </div>

              {selectedStudentGameRows.length > 0 ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={studentGamesSearchQuery}
                    onChange={(event) => setStudentGamesSearchQuery(event.target.value)}
                    placeholder="Buscar partida por nombre o fecha"
                    className="pl-9"
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {selectedStudentGameRows.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {filteredSelectedStudentGameRows.length === selectedStudentGameRows.length
                      ? `Mostrando ${selectedStudentGameRows.length} partidas registradas para este estudiante.`
                      : `Mostrando ${filteredSelectedStudentGameRows.length} de ${selectedStudentGameRows.length} partidas registradas para este estudiante.`}
                  </p>
                ) : null}
                {filteredSelectedStudentGameRows.length > 0 ? (
                  filteredSelectedStudentGameRows.map((game) => (
                    <div key={game.id} className="rounded-2xl bg-background/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{game.label}</p>
                        <Badge variant="secondary">{game.successRate}% aciertos</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{game.turnCount} turnos</Badge>
                        <Badge variant="outline">tiempo medio {formatDurationSeconds(game.avgTurnSeconds)}</Badge>
                        {game.playedAt ? <Badge variant="outline">{formatDateTime(game.playedAt)}</Badge> : null}
                      </div>
                    </div>
                  ))
                ) : selectedStudentGameRows.length > 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                    No encontré partidas que coincidan con la búsqueda activa para este estudiante.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Este estudiante todavía no registra partidas en `game-data` para esta institución. Cuando aparezcan nuevos registros, esta pantalla va a consolidarlos automáticamente.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <DeleteRecordDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteCurrentStudent}
        isPending={deleteStudentMutation.isPending}
        title={selectedStudent ? `Eliminar a ${selectedStudent.fullName}` : "Eliminar estudiante"}
        description={selectedStudent
          ? "Se va a eliminar este estudiante desde su ficha dedicada. Confirmá solo si querés ejecutar la eliminación real."
          : "Confirmá la eliminación del estudiante seleccionado."}
        confirmLabel="Sí, eliminar estudiante"
      />
    </div>
  );
}
