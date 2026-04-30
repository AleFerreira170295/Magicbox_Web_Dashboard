"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ComponentType, useMemo, useState } from "react";
import { BadgeCheck, CreditCard, GraduationCap, Search, UserRound, Users, Waves } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useClassGroups } from "@/features/class-groups/api";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
import { useProfilesOverview } from "@/features/profiles/api";
import { buildProfileDetailHref } from "@/features/profiles/profile-route";
import { useStudents } from "@/features/students/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

type ProfilesFocusFilter = "all" | "no_avatar" | "no_cards" | "no_sessions" | "no_owner" | "institution_linked";
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

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
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
      </CardContent>
    </Card>
  );
}

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

function ProfileAvatar({
  profile,
  className,
}: {
  profile: { displayName: string; avatarUrl?: string | null };
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white font-semibold text-primary", className)}>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
      ) : (
        <span>{getProfileInitials(profile.displayName)}</span>
      )}
    </div>
  );
}

export function RelevantProfiles() {
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const institutionIdFromUrl = searchParams.get("institutionId") || "";
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [focusFilter, setFocusFilter] = useState<ProfilesFocusFilter>("all");

  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const institutionsData = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const isDirectorView = currentUser?.roles.includes("director") || false;
  const isScopedActor = Boolean(currentUser?.roles.includes("institution-admin") || currentUser?.roles.includes("director"));

  const institutionOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const institution of institutionsData) {
      if (institution.id && institution.name) {
        map.set(institution.id, institution.name);
      }
    }

    for (const profile of profiles) {
      if (profile.educationalCenterId && profile.educationalCenterName) {
        map.set(profile.educationalCenterId, profile.educationalCenterName);
      }
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [institutionsData, profiles]);

  const scopedInstitutionId = isScopedActor
    ? currentUser?.educationalCenterId || null
    : institutionOptions.length === 1
      ? institutionOptions[0]?.id || null
      : null;
  const selectedInstitutionFilter = institutionFilter ?? institutionIdFromUrl;
  const effectiveInstitutionFilter = selectedInstitutionFilter || scopedInstitutionId || null;
  const scopedInstitutionName = scopedInstitutionId
    ? institutionOptions.find((institution) => institution.id === scopedInstitutionId)?.name || null
    : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && isScopedActor);

  const classGroupsQuery = useClassGroups(tokens?.accessToken, effectiveInstitutionFilter);
  const studentsQuery = useStudents(tokens?.accessToken, {
    institutionId: effectiveInstitutionFilter,
    page: 1,
    limit: 100,
    sortBy: "updated_at",
    order: "desc",
  });
  const gamesQuery = useGames(tokens?.accessToken, {
    institutionId: effectiveInstitutionFilter,
    page: 1,
    limit: 100,
    sortBy: "created_at",
    order: "desc",
  });

  const classGroups = useMemo(() => classGroupsQuery.data?.data ?? [], [classGroupsQuery.data?.data]);
  const students = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data ?? [], [gamesQuery.data?.data]);

  const institutionNameById = useMemo(() => new Map(institutionOptions.map((institution) => [institution.id, institution.name])), [institutionOptions]);
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

  const studentEntities = useMemo<RelevantEntity[]>(() => {
    return students.map((student) => {
      const classGroup = classGroupById.get(student.classGroupId);
      const educationalCenterId = classGroup?.educationalCenterId || effectiveInstitutionFilter || null;
      const metrics = studentMetrics.get(student.id);

      return {
        id: `student:${student.id}`,
        entityId: student.id,
        kind: "student",
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
  }, [classGroupById, effectiveInstitutionFilter, institutionNameById, studentMetrics, students]);

  const homeProfileEntities = useMemo<RelevantEntity[]>(() => {
    return profiles.map((profile) => ({
      id: `profile:${profile.id}`,
      entityId: profile.id,
      kind: "home-profile",
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
  }, [profiles]);

  const entities = useMemo(() => [...homeProfileEntities, ...studentEntities], [homeProfileEntities, studentEntities]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return entities.filter((entity) => {
      if (effectiveInstitutionFilter && entity.educationalCenterId !== effectiveInstitutionFilter) return false;
      if (activityFilter === "active" && !entity.isActive) return false;
      if (activityFilter === "inactive" && entity.isActive) return false;

      const matchesFocus = (() => {
        switch (focusFilter) {
          case "no_avatar":
            return !entity.avatarUrl;
          case "no_cards":
            return entity.kind === "home-profile" && entity.activeBindingCount === 0;
          case "no_sessions":
            return entity.sessionCount === 0;
          case "no_owner":
            return entity.kind === "home-profile" ? !(entity.userId || entity.userName || entity.userEmail) : false;
          case "institution_linked":
            return Boolean(entity.educationalCenterId);
          default:
            return true;
        }
      })();

      if (!matchesFocus) return false;
      if (!normalized) return true;

      return [
        entity.displayName,
        entity.userName,
        entity.userEmail,
        entity.educationalCenterName,
        entity.fileNumber,
        entity.classGroupName,
        ...entity.cardUids,
        ...entity.boundDevices.map((device) => device.name || device.deviceId || device.id),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [activityFilter, effectiveInstitutionFilter, entities, focusFilter, query]);

  const pagination = useListPagination(filtered);
  const paginatedFiltered = pagination.paginatedItems;

  const metrics = useMemo(() => {
    const activeProfiles = entities.filter((profile) => profile.isActive).length;
    const withAvatars = entities.filter((profile) => Boolean(profile.avatarUrl)).length;
    const withBindings = homeProfileEntities.filter((profile) => profile.activeBindingCount > 0).length;
    const withSessions = entities.filter((profile) => profile.sessionCount > 0).length;
    const institutionLinked = entities.filter((profile) => Boolean(profile.educationalCenterId)).length;
    const profilesWithoutCards = homeProfileEntities.filter((profile) => profile.activeBindingCount === 0).length;
    const profilesWithoutSessions = entities.filter((profile) => profile.sessionCount === 0).length;
    const profilesWithoutOwner = homeProfileEntities.filter((profile) => !(profile.userId || profile.userName || profile.userEmail)).length;
    const studentsCount = studentEntities.length;
    const homeProfilesCount = homeProfileEntities.length;

    return {
      total: entities.length,
      activeProfiles,
      withAvatars,
      withBindings,
      withSessions,
      institutionLinked,
      profilesWithoutCards,
      profilesWithoutSessions,
      profilesWithoutOwner,
      studentsCount,
      homeProfilesCount,
    };
  }, [entities, homeProfileEntities, studentEntities]);

  const focusSegments = [
    { key: "all" as const, label: "Todos", count: metrics.total },
    { key: "no_avatar" as const, label: "Sin avatar", count: metrics.total - metrics.withAvatars },
    { key: "no_cards" as const, label: "Home sin tarjeta", count: metrics.profilesWithoutCards },
    { key: "no_sessions" as const, label: "Sin sesiones", count: metrics.profilesWithoutSessions },
    { key: "no_owner" as const, label: "Sin owner", count: metrics.profilesWithoutOwner },
    { key: "institution_linked" as const, label: "Institucionales", count: metrics.institutionLinked },
  ];

  const hasAnyError = profilesQuery.error || institutionsQuery.error || classGroupsQuery.error || studentsQuery.error || gamesQuery.error;
  const isLoading = profilesQuery.isLoading || institutionsQuery.isLoading || classGroupsQuery.isLoading || studentsQuery.isLoading || gamesQuery.isLoading;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? (isDirectorView ? "Director" : "Institution admin") : "Perfiles y estudiantes"}
        title="Profiles"
        description={
          isInstitutionScopedView
            ? isDirectorView
              ? `Vista institucional para ${scopedInstitutionName}, integrando perfiles Home y estudiantes en una sola lectura.`
              : `Vista institucional para ${scopedInstitutionName}, unificando perfiles Home y estudiantes en el mismo contexto.`
            : "Vista unificada de perfiles Home y estudiantes, respetando los permisos del usuario actual."
        }
        actions={
          <div className="grid w-full gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.8fr)_minmax(180px,0.6fr)]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por perfil, estudiante, owner, institución, documento, tarjeta o grupo"
                className="w-full pl-9"
              />
            </div>
            <select
              value={selectedInstitutionFilter || scopedInstitutionId || ""}
              onChange={(event) => setInstitutionFilter(event.target.value)}
              className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={Boolean(scopedInstitutionId)}
            >
              <option value="">Todas las instituciones</option>
              {institutionOptions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
            <select
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value as "all" | "active" | "inactive")}
              className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Contexto de vista</p>
              <Badge variant={isInstitutionScopedView ? "secondary" : "outline"}>
                {isInstitutionScopedView ? (isDirectorView ? "director" : "institution-admin") : "multi-institución / global"}
              </Badge>
              <Badge variant="outline">profiles + estudiantes</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isInstitutionScopedView
                ? isDirectorView
                  ? "La lectura directoral mantiene el foco institucional e incorpora estudiantes de la misma institución."
                  : "La tabla queda anclada a la institución asignada y suma estudiantes además de perfiles Home."
                : "La vista reúne perfiles Home y estudiantes según los permisos del usuario."}
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Total" value={String(metrics.total)} icon={Users} />
            <SummaryCard label="Perfiles Home" value={String(metrics.homeProfilesCount)} icon={UserRound} />
            <SummaryCard label="Estudiantes" value={String(metrics.studentsCount)} icon={GraduationCap} />
            <SummaryCard label="Activos" value={String(metrics.activeProfiles)} icon={BadgeCheck} />
            <SummaryCard label="Con tarjeta" value={String(metrics.withBindings)} icon={CreditCard} />
            <SummaryCard label="Con sesiones" value={String(metrics.withSessions)} icon={Waves} />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap gap-2 p-5">
          {focusSegments.map((segment) => (
            <Button
              key={segment.key}
              type="button"
              size="sm"
              variant={focusFilter === segment.key ? "default" : "outline"}
              onClick={() => setFocusFilter(segment.key)}
              className="w-full justify-between text-left sm:w-auto sm:justify-center"
            >
              {segment.label}
              <Badge variant={focusFilter === segment.key ? "secondary" : "outline"} className={focusFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setFocusFilter("all");
              setQuery("");
            }}
            className="w-full sm:w-auto"
          >
            Limpiar foco
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>{isDirectorView ? "Perfiles y estudiantes para seguimiento" : "Listado de perfiles y estudiantes"}</CardTitle>
                <CardDescription>
                  {isDirectorView
                    ? "Seleccioná un registro para revisar owner, contexto institucional y señales de actividad."
                    : "Seleccioná un registro para revisar ownership, contexto institucional y actividad reciente."}
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
                summaryTestId="profiles-pagination-summary"
                controlsTestId="profiles-pagination-controls"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : hasAnyError ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(hasAnyError)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Tipo / contexto</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Tarjetas</TableHead>
                    <TableHead>Sesiones</TableHead>
                    <TableHead>Última sesión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {isInstitutionScopedView
                          ? "No hay perfiles ni estudiantes dentro de la institución actual."
                          : "No hay perfiles ni estudiantes para mostrar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedFiltered.map((profile) => {
                      const detailHref = buildProfileDetailHref({
                        kind: profile.kind,
                        entityId: profile.entityId,
                        institutionId: profile.educationalCenterId,
                        classGroupId: profile.classGroupId,
                      });

                      return (
                      <TableRow
                        key={profile.id}
                        className="cursor-pointer transition hover:bg-muted/40"
                        onClick={() => router.push(detailHref)}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <ProfileAvatar profile={profile} className="size-10 text-[11px]" />
                            <div className="min-w-0">
                              <Link
                                href={detailHref}
                                className="truncate font-medium text-foreground transition hover:text-primary"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {profile.displayName}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">{profile.kind === "student" ? `Documento / ID: ${profile.fileNumber || "-"}` : profile.ageCategory || "sin categoría"}</p>
                              <p className="truncate text-xs text-muted-foreground">Click en la fila o en el nombre para abrir el detalle</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={profile.kind === "student" ? "secondary" : "outline"}>{profile.kind === "student" ? "estudiante" : "perfil Home"}</Badge>
                              <Badge variant={profile.avatarUrl ? "secondary" : "outline"}>{profile.avatarUrl ? "avatar" : "sin avatar"}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-foreground">
                              {profile.kind === "student"
                                ? profile.classGroupName || "sin grupo asignado"
                                : profile.userName || "sin owner"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {profile.kind === "student" ? "Grupo del estudiante" : profile.userEmail || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{profile.educationalCenterName || profile.educationalCenterId || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={profile.activeBindingCount > 0 ? "success" : "outline"}>{profile.activeBindingCount}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{profile.sessionCount}</TableCell>
                        <TableCell>{formatDateTime(profile.lastSessionAt)}</TableCell>
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
          <CardTitle>{isDirectorView ? "Detalle en página dedicada" : "Detalle en página dedicada"}</CardTitle>
          <CardDescription>
            {isDirectorView
              ? "Cada registro abre ahora una vista propia, igual que en Institutions, para evitar que el detalle quede oculto en un panel lateral."
              : "Cada registro abre ahora una vista propia, igual que en Institutions, para que el detalle completo esté siempre disponible."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
            Podés entrar desde cualquier fila del listado o desde el nombre del perfil/estudiante para abrir su pantalla interna con contexto, identidad, actividad y asignación.
          </div>
          <p className="text-sm text-muted-foreground">
            Página {pagination.currentPage} de {pagination.totalPages}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
