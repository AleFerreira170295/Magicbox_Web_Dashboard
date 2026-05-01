"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, CreditCard, GraduationCap, UserRound, Waves } from "lucide-react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { hasAnyUserPermission } from "@/features/auth/permission-contract";
import { useClassGroups } from "@/features/class-groups/api";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
import { deleteHomeProfile, useProfilesOverview } from "@/features/profiles/api";
import { buildProfileDetailHref, buildProfilesOverviewHref } from "@/features/profiles/profile-route";
import { deleteStudent, useStudents } from "@/features/students/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

type RelevantEntityKind = "home-profile" | "student";

type RelevantEntity = {
  id: string;
  entityId: string;
  kind: RelevantEntityKind;
  displayName: string;
  avatarUrl?: string | null;
  age?: number | null;
  ageCategory?: string | null;
  isActive: boolean;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  educationalCenterId?: string | null;
  educationalCenterName?: string | null;
  bindingCount: number;
  activeBindingCount: number;
  cardUids: string[];
  boundDevices: { id: string; deviceId?: string | null; name?: string | null }[];
  sessionCount: number;
  lastSessionAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  fileNumber?: string | null;
  classGroupId?: string | null;
  classGroupName?: string | null;
};

function getProfileInitials(displayName: string) {
  return (
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.slice(0, 1).toUpperCase())
      .join("") || "PR"
  );
}

export function ProfileDetailPage({
  kind,
  entityId,
  institutionId,
  classGroupId,
}: {
  kind?: string | null;
  entityId?: string | null;
  institutionId?: string | null;
  classGroupId?: string | null;
}) {
  void classGroupId;
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const classGroupsQuery = useClassGroups(tokens?.accessToken, institutionId ?? null);
  const studentsQuery = useStudents(tokens?.accessToken, {
    institutionId: institutionId ?? null,
    page: 1,
    limit: 100,
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

  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const classGroups = useMemo(() => classGroupsQuery.data?.data ?? [], [classGroupsQuery.data?.data]);
  const students = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data ?? [], [gamesQuery.data?.data]);

  const institutionNameById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution.name])), [institutions]);
  const classGroupById = useMemo(() => new Map(classGroups.map((group) => [group.id, group])), [classGroups]);

  const studentMetrics = useMemo(() => {
    const metrics = new Map<string, { sessionCount: number; lastSessionAt: string | null }>();

    for (const game of games) {
      const studentIds = new Set<string>();
      for (const player of game.players) {
        if (player.studentId) studentIds.add(player.studentId);
      }
      for (const turn of game.turns) {
        if (turn.studentId) studentIds.add(turn.studentId);
      }

      const gameTimestamp = game.startDate || game.updatedAt || game.createdAt || null;
      for (const studentId of studentIds) {
        const current = metrics.get(studentId) ?? { sessionCount: 0, lastSessionAt: null };
        current.sessionCount += 1;
        if (gameTimestamp && (!current.lastSessionAt || new Date(gameTimestamp).getTime() > new Date(current.lastSessionAt).getTime())) {
          current.lastSessionAt = gameTimestamp;
        }
        metrics.set(studentId, current);
      }
    }

    return metrics;
  }, [games]);

  const entities = useMemo<RelevantEntity[]>(() => {
    const homeProfiles = profiles.map((profile) => ({
      id: `profile:${profile.id}`,
      entityId: profile.id,
      kind: "home-profile" as const,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      age: profile.age,
      ageCategory: profile.ageCategory,
      isActive: profile.isActive,
      userId: profile.userId,
      userName: profile.userName,
      userEmail: profile.userEmail,
      educationalCenterId: profile.educationalCenterId,
      educationalCenterName: profile.educationalCenterName,
      bindingCount: profile.bindingCount,
      activeBindingCount: profile.activeBindingCount,
      cardUids: profile.cardUids,
      boundDevices: profile.boundDevices,
      sessionCount: profile.sessionCount,
      lastSessionAt: profile.lastSessionAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      deletedAt: profile.deletedAt,
      fileNumber: null,
      classGroupId: null,
      classGroupName: null,
    }));

    const studentEntities = students.map((student) => {
      const classGroup = classGroupById.get(student.classGroupId);
      const educationalCenterId = classGroup?.educationalCenterId || institutionId || null;
      const metrics = studentMetrics.get(student.id);

      return {
        id: `student:${student.id}`,
        entityId: student.id,
        kind: "student" as const,
        displayName: student.fullName,
        avatarUrl: student.imageUrl,
        age: null,
        ageCategory: "Estudiante",
        isActive: !student.deletedAt,
        userId: null,
        userName: null,
        userEmail: null,
        educationalCenterId,
        educationalCenterName: educationalCenterId ? institutionNameById.get(educationalCenterId) || null : null,
        bindingCount: 0,
        activeBindingCount: 0,
        cardUids: [],
        boundDevices: [],
        sessionCount: metrics?.sessionCount ?? 0,
        lastSessionAt: metrics?.lastSessionAt ?? null,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
        deletedAt: student.deletedAt,
        fileNumber: student.fileNumber,
        classGroupId: student.classGroupId,
        classGroupName: classGroup?.name || null,
      };
    });

    return [...homeProfiles, ...studentEntities];
  }, [classGroupById, institutionId, institutionNameById, profiles, studentMetrics, students]);

  const selectedEntity = useMemo(() => {
    if (!kind || !entityId) return null;
    return entities.find((entity) => entity.kind === kind && entity.entityId === entityId) ?? null;
  }, [entities, entityId, kind]);

  const sameGroupEntities = useMemo(() => {
    if (!selectedEntity || selectedEntity.kind !== "student" || !selectedEntity.classGroupId) return [];
    return entities.filter(
      (entity) =>
        entity.id !== selectedEntity.id &&
        entity.kind === "student" &&
        entity.classGroupId === selectedEntity.classGroupId,
    );
  }, [entities, selectedEntity]);

  const sameGroupEntityIds = useMemo(() => new Set(sameGroupEntities.map((entity) => entity.id)), [sameGroupEntities]);

  const institutionEntities = useMemo(() => {
    if (!selectedEntity) return [];
    return entities.filter(
      (entity) =>
        entity.id !== selectedEntity.id &&
        entity.educationalCenterId === selectedEntity.educationalCenterId &&
        !sameGroupEntityIds.has(entity.id),
    );
  }, [entities, sameGroupEntityIds, selectedEntity]);

  const backHref = buildProfilesOverviewHref({ institutionId });
  const isLoading = profilesQuery.isLoading || institutionsQuery.isLoading || classGroupsQuery.isLoading || studentsQuery.isLoading || gamesQuery.isLoading;
  const hasFatalError = profilesQuery.error || institutionsQuery.error || classGroupsQuery.error || studentsQuery.error || gamesQuery.error;
  const missingRequiredIds = !kind || !entityId;
  const canDeleteStudents = hasAnyUserPermission(currentUser, "student:delete");
  const canDeleteSelectedEntity = Boolean(
    selectedEntity && (
      (selectedEntity.kind === "student" && canDeleteStudents)
      || (selectedEntity.kind === "home-profile" && selectedEntity.userId && selectedEntity.userId === currentUser?.id)
    ),
  );

  const deleteEntityMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntity || !tokens?.accessToken) throw new Error("No hay registro seleccionado.");
      if (selectedEntity.kind === "student") {
        await deleteStudent(tokens.accessToken, selectedEntity.entityId);
        return;
      }
      await deleteHomeProfile(tokens.accessToken, selectedEntity.entityId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profiles-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["games"] }),
      ]);
      setIsDeleteDialogOpen(false);
      router.push(backHref);
    },
  });

  async function handleDeleteSelectedEntity() {
    if (!canDeleteSelectedEntity) return;
    await deleteEntityMutation.mutateAsync();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Profiles · detalle interno"
        title={selectedEntity ? selectedEntity.displayName : "Detalle del registro"}
        description={selectedEntity
          ? `Vista dedicada del ${selectedEntity.kind === "student" ? "estudiante" : "perfil Home"} para revisar su contexto, asignación y actividad visible.`
          : "Entrá a un registro desde Profiles para revisar su detalle en una pantalla dedicada."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedEntity && canDeleteSelectedEntity ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className={cn(buttonVariants({ variant: "destructive" }))}
                disabled={deleteEntityMutation.isPending}
              >
                Eliminar registro
              </button>
            ) : null}
            <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
              <ArrowLeft className="size-4" />
              Volver a Profiles
            </Link>
          </div>
        }
      />

      {missingRequiredIds ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Falta contexto para abrir este detalle. Volvé a Profiles y entrá nuevamente desde la fila del registro.
          </CardContent>
        </Card>
      ) : hasFatalError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-destructive">
            No pude preparar la vista del registro. {getErrorMessage(hasFatalError)}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-[28px]" />
          <Skeleton className="h-72 rounded-[28px]" />
        </div>
      ) : !selectedEntity ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No encontré el registro solicitado dentro del alcance visible. Puede haber cambiado el filtro base o la carga de datos.
          </CardContent>
        </Card>
      ) : (
        <>
          {deleteEntityMutation.error ? (
            <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-6 text-sm text-destructive">
                No pude eliminar el registro. {getErrorMessage(deleteEntityMutation.error)}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-primary/10 font-semibold text-primary">
                    {selectedEntity.avatarUrl ? (
                      <img src={selectedEntity.avatarUrl} alt={selectedEntity.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span>{getProfileInitials(selectedEntity.displayName)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">{selectedEntity.displayName}</h2>
                      <Badge variant={selectedEntity.kind === "student" ? "secondary" : "outline"}>{selectedEntity.kind === "student" ? "estudiante" : "perfil Home"}</Badge>
                      <Badge variant={selectedEntity.isActive ? "success" : "outline"}>{selectedEntity.isActive ? "activo" : "inactivo"}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedEntity.kind === "student" ? (
                        <>
                          <Badge variant="outline">Documento / ID: {selectedEntity.fileNumber || "-"}</Badge>
                          <Badge variant="outline"><GraduationCap className="mr-1 size-3" />{selectedEntity.classGroupName || "sin grupo visible"}</Badge>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">Owner: {selectedEntity.userName || selectedEntity.userEmail || "sin owner"}</Badge>
                          <Badge variant="outline">{selectedEntity.cardUids.length} cards</Badge>
                        </>
                      )}
                      {selectedEntity.educationalCenterName ? <Badge variant="outline"><Building2 className="mr-1 size-3" />{selectedEntity.educationalCenterName}</Badge> : null}
                      <Badge variant="outline">act. {formatDateTime(selectedEntity.updatedAt)}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {selectedEntity.kind === "student"
                        ? "Esta vista deja visible el detalle del estudiante sin depender del panel lateral de Profiles."
                        : "Esta vista deja visible el detalle del perfil Home sin depender del panel lateral de Profiles."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sesiones</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedEntity.sessionCount}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tarjetas activas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedEntity.activeBindingCount}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dispositivos</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedEntity.boundDevices.length}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Última sesión</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(selectedEntity.lastSessionAt)}</p>
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
                  Podés saltar a otros registros visibles del mismo grupo o de la misma institución sin volver al listado principal.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1" data-testid="profile-detail-navigation-list">
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Institución activa</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{selectedEntity.educationalCenterName || selectedEntity.educationalCenterId || "Sin institución visible"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedEntity.kind === "student" ? selectedEntity.classGroupName || "Sin grupo visible" : "Perfil Home visible dentro del alcance actual."}</p>
                </div>

                {sameGroupEntities.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mismo grupo</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Estudiantes que comparten el grupo visible con este perfil.
                      </p>
                    </div>
                    {sameGroupEntities.map((entity) => (
                      <Link
                        key={entity.id}
                        href={buildProfileDetailHref({
                          kind: entity.kind,
                          entityId: entity.entityId,
                          institutionId: entity.educationalCenterId,
                          classGroupId: entity.classGroupId,
                        })}
                        className="block rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{entity.displayName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{entity.kind === "student" ? `Estudiante · ${entity.classGroupName || "sin grupo"}` : entity.userName || entity.userEmail || "Perfil Home"}</p>
                          </div>
                          <Badge variant="outline">{entity.sessionCount} sesiones</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {institutionEntities.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Misma institución</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Otros perfiles y estudiantes visibles asociados a esta institución.
                      </p>
                    </div>
                    {institutionEntities.map((entity) => (
                      <Link
                        key={entity.id}
                        href={buildProfileDetailHref({
                          kind: entity.kind,
                          entityId: entity.entityId,
                          institutionId: entity.educationalCenterId,
                          classGroupId: entity.classGroupId,
                        })}
                        className="block rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{entity.displayName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{entity.kind === "student" ? `Estudiante · ${entity.classGroupName || "sin grupo"}` : entity.userName || entity.userEmail || "Perfil Home"}</p>
                          </div>
                          <Badge variant="outline">{entity.sessionCount} sesiones</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {sameGroupEntities.length === 0 && institutionEntities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                    No hay otros registros visibles dentro de esta institución por ahora.
                  </div>
                ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Identidad y asignación</CardTitle>
              <CardDescription>
                Resumen operativo del registro y de lo que hoy queda visible por permisos dentro de Profiles.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resumen base</p>
                <div className="mt-3 grid gap-2 text-sm text-foreground">
                  <p>Tipo: {selectedEntity.kind === "student" ? "Estudiante institucional" : "Perfil Home"}</p>
                  <p>Institución: {selectedEntity.educationalCenterName || selectedEntity.educationalCenterId || "-"}</p>
                  <p>{selectedEntity.kind === "student" ? `Grupo: ${selectedEntity.classGroupName || "-"}` : `Owner: ${selectedEntity.userName || selectedEntity.userEmail || "sin owner"}`}</p>
                  <p>{selectedEntity.kind === "student" ? `Documento / ID: ${selectedEntity.fileNumber || "-"}` : `Categoría: ${selectedEntity.ageCategory || "sin categoría"}`}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Actividad visible</p>
                <div className="mt-3 grid gap-2 text-sm text-foreground">
                  <p>Sesiones: {selectedEntity.sessionCount}</p>
                  <p>Última sesión: {formatDateTime(selectedEntity.lastSessionAt)}</p>
                  <p>Cards activas: {selectedEntity.activeBindingCount}</p>
                  <p>Dispositivos visibles: {selectedEntity.boundDevices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="size-5 text-primary" />
                  Tarjetas vinculadas
                </CardTitle>
                <CardDescription>
                  {selectedEntity.kind === "student" ? "Los estudiantes no exponen cards propias en este registro." : "Cards visibles asociadas al perfil Home."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedEntity.cardUids.length === 0 ? (
                  <Badge variant="outline">{selectedEntity.kind === "student" ? "sin cards en este registro" : "sin cards activas"}</Badge>
                ) : (
                  selectedEntity.cardUids.map((cardUid) => (
                    <Badge key={cardUid} variant="outline">{cardUid}</Badge>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Waves className="size-5 text-primary" />
                  Dispositivos vinculados
                </CardTitle>
                <CardDescription>
                  Dispositivos o ausencia de vínculo visible dentro del alcance actual.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedEntity.boundDevices.length === 0 ? (
                  <Badge variant="outline">sin dispositivo asociado</Badge>
                ) : (
                  selectedEntity.boundDevices.map((device) => (
                    <Badge key={device.id} variant="secondary">{device.name || device.deviceId || device.id}</Badge>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <DeleteRecordDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSelectedEntity}
        isPending={deleteEntityMutation.isPending}
        title={selectedEntity ? `Eliminar ${selectedEntity.displayName}` : "Eliminar registro"}
        description={selectedEntity
          ? `Se va a eliminar este ${selectedEntity.kind === "student" ? "estudiante" : "perfil Home"} desde su pantalla de detalle. Confirmá solo si querés ejecutar la eliminación real.`
          : "Confirmá la eliminación del registro seleccionado."}
        confirmLabel={selectedEntity?.kind === "student" ? "Sí, eliminar estudiante" : "Sí, eliminar perfil"}
      />
    </div>
  );
}
