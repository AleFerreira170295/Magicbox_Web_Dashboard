"use client";

/* eslint-disable @next/next/no-img-element */

import { type ComponentType, useMemo, useState } from "react";
import { BadgeCheck, CreditCard, Search, UserRound, Users, Waves } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useProfilesOverview } from "@/features/profiles/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

type ProfilesFocusFilter = "all" | "no_avatar" | "no_cards" | "no_sessions" | "no_owner" | "institution_linked";

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

function getProfileInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "PR";
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
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [focusFilter, setFocusFilter] = useState<ProfilesFocusFilter>("all");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const isDirectorView = currentUser?.roles.includes("director") || false;
  const isScopedActor = Boolean(
    currentUser?.roles.includes("institution-admin") || currentUser?.roles.includes("director"),
  );

  const institutions = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles) {
      if (profile.educationalCenterId && profile.educationalCenterName) {
        map.set(profile.educationalCenterId, profile.educationalCenterName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles]);

  const scopedInstitutionId = isScopedActor
    ? currentUser?.educationalCenterId || null
    : institutions.length === 1
      ? institutions[0]?.id || null
      : null;
  const scopedInstitutionName = scopedInstitutionId
    ? institutions.find((institution) => institution.id === scopedInstitutionId)?.name || null
    : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && isScopedActor);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveInstitutionFilter = institutionFilter || scopedInstitutionId || "";

    return profiles.filter((profile) => {
      if (effectiveInstitutionFilter && profile.educationalCenterId !== effectiveInstitutionFilter) return false;
      if (activityFilter === "active" && !profile.isActive) return false;
      if (activityFilter === "inactive" && profile.isActive) return false;
      const matchesFocus = (() => {
        switch (focusFilter) {
          case "no_avatar":
            return !profile.avatarUrl;
          case "no_cards":
            return profile.activeBindingCount === 0;
          case "no_sessions":
            return profile.sessionCount === 0;
          case "no_owner":
            return !(profile.userId || profile.userName || profile.userEmail);
          case "institution_linked":
            return Boolean(profile.educationalCenterId);
          default:
            return true;
        }
      })();
      if (!matchesFocus) return false;
      if (!normalized) return true;

      return [
        profile.displayName,
        profile.userName,
        profile.userEmail,
        profile.educationalCenterName,
        ...profile.cardUids,
        ...profile.boundDevices.map((device) => device.name || device.deviceId || device.id),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [activityFilter, focusFilter, institutionFilter, profiles, query, scopedInstitutionId]);

  const selectedProfile = useMemo(
    () => filtered.find((profile) => profile.id === selectedProfileId) || profiles.find((profile) => profile.id === selectedProfileId) || null,
    [filtered, profiles, selectedProfileId],
  );

  const metrics = useMemo(() => {
    const activeProfiles = profiles.filter((profile) => profile.isActive).length;
    const withAvatars = profiles.filter((profile) => Boolean(profile.avatarUrl)).length;
    const withBindings = profiles.filter((profile) => profile.activeBindingCount > 0).length;
    const withSessions = profiles.filter((profile) => profile.sessionCount > 0).length;
    const institutionLinked = profiles.filter((profile) => Boolean(profile.educationalCenterId)).length;
    const profilesWithoutCards = profiles.filter((profile) => profile.activeBindingCount === 0).length;
    const profilesWithoutSessions = profiles.filter((profile) => profile.sessionCount === 0).length;
    const profilesWithoutOwner = profiles.filter((profile) => !(profile.userId || profile.userName || profile.userEmail)).length;

    return {
      total: profiles.length,
      activeProfiles,
      withAvatars,
      withBindings,
      withSessions,
      institutionLinked,
      profilesWithoutCards,
      profilesWithoutSessions,
      profilesWithoutOwner,
    };
  }, [profiles]);

  const focusSegments = [
    { key: "all" as const, label: "Todos", count: metrics.total },
    { key: "no_avatar" as const, label: "Sin avatar", count: metrics.total - metrics.withAvatars },
    { key: "no_cards" as const, label: "Sin tarjeta", count: metrics.profilesWithoutCards },
    { key: "no_sessions" as const, label: "Sin sesiones", count: metrics.profilesWithoutSessions },
    { key: "no_owner" as const, label: "Sin owner", count: metrics.profilesWithoutOwner },
    { key: "institution_linked" as const, label: "Institucionales", count: metrics.institutionLinked },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? (isDirectorView ? "Director" : "Institution admin") : "Perfiles Home"}
        title="Profiles"
        description={
          isInstitutionScopedView
            ? isDirectorView
              ? `Vista institucional de perfiles Home para ${scopedInstitutionName}, pensada para seguimiento general de owners, tarjetas y actividad visible.`
              : `Vista operativa real de perfiles Home para ${scopedInstitutionName}, ya alineada con el alcance institucional visible.`
            : "Vista operativa real de perfiles Home, con ownership, bindings y actividad de sesiones. Ya no usa `users` como proxy del módulo."
        }
        actions={
          <div className="grid w-full gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.8fr)_minmax(180px,0.6fr)]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por perfil, owner, institución, tarjeta o dispositivo"
                className="w-full pl-9"
              />
            </div>
            <select
              value={institutionFilter || scopedInstitutionId || ""}
              onChange={(event) => setInstitutionFilter(event.target.value)}
              className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
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
              <p className="text-sm font-medium text-foreground">Alcance operativo</p>
              <Badge variant={isInstitutionScopedView ? "secondary" : "outline"}>
                {isInstitutionScopedView ? (isDirectorView ? "director" : "institution-admin") : "multi-institución / global"}
              </Badge>
              <Badge variant="outline">profiles reales</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isInstitutionScopedView
                ? isDirectorView
                  ? "La lectura directoral deja en primer plano owners, tarjetas activas y actividad visible para seguimiento institucional, sin convertir perfiles en una pantalla técnica de administración." 
                  : "La tabla queda anclada a la institución visible por ACL, así que el filtro institucional pasa a ser informativo y no abre otras sedes."
                : "La vista refleja perfiles reales con ownership, cards y bindings visibles según el alcance actual."}
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {profilesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Perfiles" value={String(metrics.total)} hint="Perfiles Home visibles en el alcance actual." icon={Users} />
            <SummaryCard label="Activos" value={String(metrics.activeProfiles)} hint="Perfiles no archivados y operativamente vigentes." icon={BadgeCheck} />
            <SummaryCard label="Con avatar" value={String(metrics.withAvatars)} hint="Mejora mucho la identificación visual en lectura rápida." icon={UserRound} />
            <SummaryCard label="Con tarjeta" value={String(metrics.withBindings)} hint="Perfiles con bindings activos a cards." icon={CreditCard} />
            <SummaryCard label="Con sesiones" value={String(metrics.withSessions)} hint="Perfiles que ya aparecen en historial de juego." icon={Waves} />
            <SummaryCard label="Institucionales" value={String(metrics.institutionLinked)} hint="Perfiles cuyos owners ya están ligados a una institución." icon={UserRound} />
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

      <div className="grid gap-6 2xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{isDirectorView ? "Perfiles visibles para seguimiento" : "Listado de perfiles"}</CardTitle>
            <CardDescription>
              {isDirectorView
                ? "Seleccioná un perfil para revisar owner, tarjetas activas y señales de actividad visibles desde una lectura institucional."
                : "Seleccioná un perfil para revisar ownership, tarjetas, dispositivos vinculados y actividad reciente."}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {profilesQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : profilesQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(profilesQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Owner</TableHead>
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
                          ? "No hay perfiles Home ligados a la institución visible. Los perfiles personales sin vínculo institucional quedan fuera de esta vista operativa."
                          : "No hay perfiles para mostrar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((profile) => (
                      <TableRow
                        key={profile.id}
                        className={cn("cursor-pointer", selectedProfileId === profile.id && "bg-primary/5")}
                        onClick={() => setSelectedProfileId(profile.id)}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <ProfileAvatar profile={profile} className="size-10 text-[11px]" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{profile.displayName}</p>
                              <p className="truncate text-xs text-muted-foreground">{profile.ageCategory || "sin categoría"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-foreground">{profile.userName || "sin owner"}</p>
                            <p className="text-xs text-muted-foreground">{profile.userEmail || "-"}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge variant={profile.avatarUrl ? "secondary" : "outline"}>{profile.avatarUrl ? "avatar" : "sin avatar"}</Badge>
                            </div>
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
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{isDirectorView ? "Detalle de seguimiento" : "Detalle de perfil"}</CardTitle>
            <CardDescription>
              {isDirectorView
                ? "Resumen rápido del perfil, su owner y señales visibles de uso para seguimiento institucional."
                : "Resumen rápido del perfil, su owner y señales de uso relevantes para operación."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedProfile ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                {isDirectorView ? "Elegí un perfil para revisar su detalle de seguimiento." : "Elegí un perfil para revisar su detalle operativo."}
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProfileAvatar profile={selectedProfile} className="size-14 text-sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedProfile.displayName}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">Owner {selectedProfile.userName || selectedProfile.userEmail || selectedProfile.userId}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedProfile.isActive ? "success" : "outline"}>{selectedProfile.isActive ? "activo" : "inactivo"}</Badge>
                      <Badge variant={selectedProfile.avatarUrl ? "secondary" : "outline"}>{selectedProfile.avatarUrl ? "avatar cargado" : "sin avatar"}</Badge>
                      <Badge variant="outline">{selectedProfile.sessionCount} sesiones</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Institución: {selectedProfile.educationalCenterName || selectedProfile.educationalCenterId || "-"}</p>
                    <p>Categoría: {selectedProfile.ageCategory || "sin categoría"}</p>
                    <p>Edad: {selectedProfile.age ?? "sin edad"}</p>
                    <p>Última sesión: {formatDateTime(selectedProfile.lastSessionAt)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Tarjetas vinculadas</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProfile.cardUids.length === 0 ? (
                      <Badge variant="outline">sin cards activas</Badge>
                    ) : (
                      selectedProfile.cardUids.map((cardUid) => (
                        <Badge key={cardUid} variant="outline">{cardUid}</Badge>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Dispositivos vinculados</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProfile.boundDevices.length === 0 ? (
                      <Badge variant="outline">sin dispositivo asociado</Badge>
                    ) : (
                      selectedProfile.boundDevices.map((device) => (
                        <Badge key={device.id} variant="secondary">{device.name || device.deviceId || device.id}</Badge>
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
