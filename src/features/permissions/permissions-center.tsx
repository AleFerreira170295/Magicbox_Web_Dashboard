"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import { AlertTriangle, KeyRound, Layers3, ShieldCheck, ShieldEllipsis, UserRound } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessActions, useAccessFeatures, usePermissions } from "@/features/access-control/api";
import { useAuth } from "@/features/auth/auth-context";
import { useInstitutions } from "@/features/institutions/api";
import { useUsers } from "@/features/users/api";
import { getErrorMessage } from "@/lib/utils";

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

function formatScopeLabel(scopeId: string | null | undefined, institutionName?: string | null) {
  if (!scopeId) return "Global";
  return institutionName?.trim() || scopeId;
}

export function PermissionsCenter() {
  const { tokens, user } = useAuth();

  const actionsQuery = useAccessActions(tokens?.accessToken);
  const featuresQuery = useAccessFeatures(tokens?.accessToken);
  const permissionsQuery = usePermissions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const actions = useMemo(() => actionsQuery.data?.data || [], [actionsQuery.data]);
  const features = useMemo(() => featuresQuery.data?.data || [], [featuresQuery.data]);
  const permissions = useMemo(() => permissionsQuery.data?.data || [], [permissionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);

  const loading =
    actionsQuery.isLoading ||
    featuresQuery.isLoading ||
    permissionsQuery.isLoading ||
    usersQuery.isLoading ||
    institutionsQuery.isLoading;

  const fatalError =
    actionsQuery.error ||
    featuresQuery.error ||
    permissionsQuery.error ||
    usersQuery.error ||
    institutionsQuery.error;

  const model = useMemo(() => {
    const userById = new Map(users.map((item) => [item.id, item]));
    const featureById = new Map(features.map((item) => [item.id, item]));
    const actionById = new Map(actions.map((item) => [item.id, item]));
    const institutionById = new Map(institutions.map((item) => [item.id, item]));

    const explicitPermissionUsers = new Set(permissions.map((item) => item.userId)).size;
    const scopedPermissions = permissions.filter((item) => item.educationalCenterId).length;
    const globalPermissions = permissions.length - scopedPermissions;
    const missingReferences = permissions.filter(
      (item) => !userById.has(item.userId) || !featureById.has(item.featureId) || !actionById.has(item.actionId),
    ).length;

    const permissionRows = permissions.map((item) => {
      const actor = userById.get(item.userId);
      const feature = featureById.get(item.featureId);
      const action = actionById.get(item.actionId);
      const institution = item.educationalCenterId
        ? institutionById.get(item.educationalCenterId)
        : undefined;

      return {
        id: item.id,
        userName: actor?.fullName || "Usuario no resuelto",
        userEmail: actor?.email || item.userId,
        roleSummary: actor?.roles.length ? actor.roles.join(", ") : "sin rol",
        featureCode: feature?.code || item.featureId,
        actionCode: action?.code || item.actionId,
        scopeLabel: formatScopeLabel(item.educationalCenterId, institution?.name),
        createdAt: item.createdAt || null,
        hasReferenceGap: !actor || !feature || !action,
      };
    });

    const reviewProfiles = users
      .filter((item) => item.roles.length === 0 || item.permissions.length > 0)
      .map((item) => ({
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        institutionLabel: formatScopeLabel(
          item.educationalCenterId,
          item.educationalCenterId ? institutionById.get(item.educationalCenterId)?.name : undefined,
        ),
        roles: item.roles,
        permissions: item.permissions,
        signal:
          item.roles.length === 0
            ? "sin rol"
            : item.permissions.length > 0
              ? "override explícito"
              : "revisar",
      }))
      .slice(0, 12);

    return {
      explicitPermissionUsers,
      scopedPermissions,
      globalPermissions,
      missingReferences,
      permissionRows,
      reviewProfiles,
    };
  }, [actions, features, institutions, permissions, users]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Permisos"
        description="Esta pantalla ya dejó de ser conceptual. Ahora usa el catálogo real de actions, features y permisos explícitos para leer la gobernanza efectiva del sistema."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Actions activas"
              value={String(actions.length)}
              hint="Catálogo operativo disponible para construir permisos explícitos."
              icon={KeyRound}
            />
            <SummaryCard
              label="Features modeladas"
              value={String(features.length)}
              hint="Superficies del backend que hoy pueden participar en ACL."
              icon={Layers3}
            />
            <SummaryCard
              label="Permisos explícitos"
              value={String(permissions.length)}
              hint="Overrides vigentes detectados por la API real de access-control."
              icon={ShieldEllipsis}
            />
            <SummaryCard
              label="Usuarios con override"
              value={String(model.explicitPermissionUsers)}
              hint="Cuentas con personalización explícita por fuera del bundle de rol."
              icon={UserRound}
            />
          </>
        )}
      </div>

      {fatalError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle className="text-destructive">No pudimos cargar la gobernanza ACL real</CardTitle>
            <CardDescription>{getErrorMessage(fatalError)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Catálogo ACL operativo</CardTitle>
            <CardDescription>
              Acciones, features y volumen real de overrides. Esto sirve para validar si el backend expone la base mínima que la UI necesita.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Actions disponibles
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.length ? actions.map((action) => (
                  <Badge key={action.id} variant="secondary">{action.code}</Badge>
                )) : <Badge variant="outline">sin actions</Badge>}
              </div>
            </div>

            <div className="rounded-2xl bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Layers3 className="size-4 text-primary" />
                Features disponibles
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {features.length ? features.map((feature) => (
                  <Badge key={feature.id} variant="outline">{feature.code}</Badge>
                )) : <Badge variant="outline">sin features</Badge>}
              </div>
            </div>

            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {permissions.length === 0
                ? "Todavía no hay permisos explícitos activos. El sistema está apoyándose sobre roles base y alcance implícito."
                : `Hoy vemos ${model.globalPermissions} overrides globales y ${model.scopedPermissions} overrides con scope institucional.`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Sesión actual y señales de revisión</CardTitle>
            <CardDescription>
              Lectura rápida del actor autenticado y de los desvíos que conviene revisar primero.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{user?.fullName || "Sin nombre"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || "Sin email"}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">Roles efectivos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user?.roles.length ? user.roles.map((role) => (
                  <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                )) : <Badge variant="outline">sin roles</Badge>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">Permisos explícitos visibles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user?.permissions.length ? user.permissions.map((permission) => (
                  <Badge key={permission} variant="outline">{permission}</Badge>
                )) : <Badge variant="outline">sin permisos explícitos</Badge>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Perfiles sin rol</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {loading ? "-" : String(users.filter((item) => item.roles.length === 0).length)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Referencias rotas</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "-" : String(model.missingReferences)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              La pantalla ya sirve para validar el contrato ACL compartido, no solo para explicar el modelo en abstracto.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Catálogo de actions</CardTitle>
          <CardDescription>
            El endpoint real de actions ahora queda visible en la UI y deja de ser una dependencia implícita del módulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-60 w-full rounded-none" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Actualizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No hay actions cargadas.
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell><Badge variant="secondary">{action.code}</Badge></TableCell>
                      <TableCell className="font-medium text-foreground">{action.name}</TableCell>
                      <TableCell>{action.description || "-"}</TableCell>
                      <TableCell>{action.updatedAt || action.createdAt || "-"}</TableCell>
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
          <CardTitle>Overrides explícitos vigentes</CardTitle>
          <CardDescription>
            Una tabla operativa para cruzar usuario, feature, action y scope institucional sin salir del dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Señal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.permissionRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No hay permisos explícitos activos para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  model.permissionRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{row.userName}</p>
                          <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                          <p className="text-xs text-muted-foreground">{row.roleSummary}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{row.featureCode}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{row.actionCode}</Badge></TableCell>
                      <TableCell>{row.scopeLabel}</TableCell>
                      <TableCell>
                        {row.hasReferenceGap ? (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="size-3" />
                            referencia incompleta
                          </Badge>
                        ) : (
                          <Badge variant="outline">vigente</Badge>
                        )}
                      </TableCell>
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
          <CardTitle>Perfiles que conviene revisar</CardTitle>
          <CardDescription>
            Usuarios sin rol o con overrides explícitos, para que el módulo también sirva como cola de revisión y no solo como catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Señal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.reviewProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No hay perfiles marcados para revisión ahora mismo.
                    </TableCell>
                  </TableRow>
                ) : (
                  model.reviewProfiles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{item.fullName}</p>
                          <p className="text-xs text-muted-foreground">{item.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.institutionLabel}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.roles.length ? item.roles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                          )) : <Badge variant="outline">sin rol</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.permissions.length ? item.permissions.map((permission) => (
                            <Badge key={permission} variant="outline">{permission}</Badge>
                          )) : <Badge variant="outline">sin permisos explícitos</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.signal === "sin rol" ? "warning" : "secondary"}>{item.signal}</Badge>
                      </TableCell>
                    </TableRow>
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
