"use client";

import { type ComponentType, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, Search, Trash2, UserRound, Users, Waves } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { resolveInstitutionScopedRoleLabel } from "@/features/auth/role-resolver";
import { deleteProfile, useProfilesOverview } from "@/features/profiles/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

type FeedbackState = { type: "success" | "error"; message: string } | null;

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

export function RelevantProfiles() {
  const { tokens, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const isScopedActor = Boolean(
    currentUser?.roles.includes("institution-admin") || currentUser?.roles.includes("director"),
  );
  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canDeleteScopedProfiles = hasAnyPermission("user:delete");

  const deleteProfileMutation = useMutation({
    mutationFn: (profileId: string) => deleteProfile(tokens?.accessToken as string, profileId),
    onSuccess: async (_result, profileId) => {
      await queryClient.invalidateQueries({ queryKey: ["profiles-overview"] });
      setSelectedProfileId((current) => (current === profileId ? null : current));
      setFeedback({ type: "success", message: "Perfil eliminado." });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

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
  const scopedRoleLabel = resolveInstitutionScopedRoleLabel(currentUser?.roles);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveInstitutionFilter = institutionFilter || scopedInstitutionId || "";

    return profiles.filter((profile) => {
      if (effectiveInstitutionFilter && profile.educationalCenterId !== effectiveInstitutionFilter) return false;
      if (activityFilter === "active" && !profile.isActive) return false;
      if (activityFilter === "inactive" && profile.isActive) return false;
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
  }, [activityFilter, institutionFilter, profiles, query, scopedInstitutionId]);

  const selectedProfile = useMemo(
    () => filtered.find((profile) => profile.id === selectedProfileId) || profiles.find((profile) => profile.id === selectedProfileId) || null,
    [filtered, profiles, selectedProfileId],
  );

  const canDeleteSelectedProfile = Boolean(
    selectedProfile && currentUser && (selectedProfile.userId === currentUser.id || canDeleteScopedProfiles),
  );
  const isDeleteBlockedByState = !selectedProfile?.isActive || Boolean(selectedProfile?.deletedAt);

  async function handleDelete() {
    if (!selectedProfile) return;
    if (isDeleteBlockedByState) {
      setFeedback({ type: "error", message: "Ese perfil ya no está activo." });
      return;
    }
    if (!canDeleteSelectedProfile) {
      setFeedback({ type: "error", message: "Tu acceso actual no permite eliminar este perfil." });
      return;
    }
    if (!globalThis.confirm(`¿Eliminar el perfil ${selectedProfile.displayName}?`)) return;
    setFeedback(null);
    await deleteProfileMutation.mutateAsync(selectedProfile.id);
  }

  const metrics = useMemo(() => {
    const activeProfiles = profiles.filter((profile) => profile.isActive).length;
    const withBindings = profiles.filter((profile) => profile.activeBindingCount > 0).length;
    const withGameplay = profiles.filter((profile) => profile.sessionCount > 0).length;
    const institutionLinked = profiles.filter((profile) => Boolean(profile.educationalCenterId)).length;

    return {
      total: profiles.length,
      activeProfiles,
      withBindings,
      withGameplay,
      institutionLinked,
    };
  }, [profiles]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? (scopedRoleLabel === "director" ? "Director" : "Institution admin") : "Perfiles Home"}
        title="Profiles"
        description={
          isInstitutionScopedView
            ? `Vista operativa real de perfiles Home para ${scopedInstitutionName}, ya alineada con el alcance institucional visible.`
            : "Vista operativa real de perfiles Home, con ownership, bindings y actividad de sesiones. Ya no usa `users` como proxy del módulo."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por perfil, owner, institución, tarjeta o dispositivo"
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
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value as "all" | "active" | "inactive")}
              className="h-10 min-w-40 rounded-md border border-input bg-background px-3 text-sm"
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
                {isInstitutionScopedView ? scopedRoleLabel : "multi-institución / global"}
              </Badge>
              <Badge variant="outline">profiles reales</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isInstitutionScopedView
                ? "La tabla queda anclada a la institución visible por ACL, así que el filtro institucional pasa a ser informativo y no abre otras sedes."
                : "La vista refleja perfiles reales con ownership, cards y bindings visibles según el alcance actual."}
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {profilesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Perfiles" value={String(metrics.total)} hint="Perfiles Home visibles en el alcance actual." icon={Users} />
            <SummaryCard label="Activos" value={String(metrics.activeProfiles)} hint="Perfiles vigentes y utilizables en la experiencia actual." icon={BadgeCheck} />
            <SummaryCard label="Con tarjeta" value={String(metrics.withBindings)} hint="Perfiles con tarjeta o binding listo para jugar." icon={CreditCard} />
            <SummaryCard label="Con juego" value={String(metrics.withGameplay)} hint="Perfiles que ya muestran historial de partidas o sesiones." icon={Waves} />
            <SummaryCard label="Con institución" value={String(metrics.institutionLinked)} hint="Perfiles ligados a un owner con contexto institucional." icon={UserRound} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Listado de perfiles</CardTitle>
            <CardDescription>
              Seleccioná un perfil para revisar ownership, tarjetas, dispositivos vinculados y actividad reciente.
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
                          <div>
                            <p className="font-medium text-foreground">{profile.displayName}</p>
                            <p className="text-xs text-muted-foreground">{profile.ageCategory || "sin categoría"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-foreground">{profile.userName || "sin owner"}</p>
                            <p className="text-xs text-muted-foreground">{profile.userEmail || "-"}</p>
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
            <CardTitle>Detalle de perfil</CardTitle>
            <CardDescription>
              Resumen rápido del perfil, su owner y señales de uso relevantes para operación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {feedback ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm",
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-destructive/20 bg-destructive/5 text-destructive",
                )}
              >
                {feedback.message}
              </div>
            ) : null}

            {!selectedProfile ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí un perfil para revisar su detalle operativo.
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedProfile.displayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Owner {selectedProfile.userName || selectedProfile.userEmail || selectedProfile.userId}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={selectedProfile.isActive ? "success" : "outline"}>{selectedProfile.isActive ? "activo" : "inactivo"}</Badge>
                      <Badge variant="outline">{selectedProfile.sessionCount} sesiones</Badge>
                      {canDeleteSelectedProfile ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deleteProfileMutation.isPending || isDeleteBlockedByState}
                          onClick={handleDelete}
                        >
                          <Trash2 className="size-4" />
                          {deleteProfileMutation.isPending ? "Eliminando..." : "Eliminar perfil"}
                        </Button>
                      ) : (
                        <Badge variant="outline">Sin permiso para eliminar</Badge>
                      )}
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
