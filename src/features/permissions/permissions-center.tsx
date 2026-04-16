"use client";

import { useMemo, useState } from "react";
import type { ComponentType, SelectHTMLAttributes } from "react";
import { AlertTriangle, KeyRound, Layers3, Search, ShieldCheck, ShieldEllipsis, UserRound } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessActions, useAccessFeatures, usePermissions } from "@/features/access-control/api";
import { useAuth } from "@/features/auth/auth-context";
import { useInstitutions } from "@/features/institutions/api";
import { useUsers } from "@/features/users/api";
import { cn, getErrorMessage } from "@/lib/utils";

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

function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}

function formatScopeLabel(scopeId: string | null | undefined, institutionName?: string | null) {
  if (!scopeId) return "Global";
  return institutionName?.trim() || scopeId;
}

function hasAnyPermission(grantedPermissions: string[] | undefined, ...keys: string[]) {
  const granted = new Set(grantedPermissions || []);
  return keys.some((key) => granted.has(key));
}

export function PermissionsCenter() {
  const { tokens, user } = useAuth();
  const [query, setQuery] = useState("");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");

  const currentPermissions = user?.permissions || [];
  const isAdminView = user?.roles.includes("admin") || false;
  const isInstitutionAdminView = !isAdminView && (user?.roles.includes("institution-admin") || false);

  const canReadAcl =
    isAdminView || hasAnyPermission(currentPermissions, "access_control:read", "access-control:read");
  const canReadFeatureCatalog =
    isAdminView || hasAnyPermission(currentPermissions, "feature:read", "feature:read:any");
  const canReadUsers = isAdminView || hasAnyPermission(currentPermissions, "user:read");
  const canReadInstitutions =
    isAdminView ||
    hasAnyPermission(
      currentPermissions,
      "educational_center:read",
      "educational-center:read",
      "educational_center:read:any",
      "educational-center:read:any",
    );

  const actionsQuery = useAccessActions(canReadAcl ? tokens?.accessToken : undefined);
  const featuresQuery = useAccessFeatures(canReadFeatureCatalog ? tokens?.accessToken : undefined);
  const permissionsQuery = usePermissions(canReadAcl ? tokens?.accessToken : undefined);
  const usersQuery = useUsers(canReadUsers ? tokens?.accessToken : undefined);
  const institutionsQuery = useInstitutions(canReadInstitutions ? tokens?.accessToken : undefined);

  const actions = useMemo(() => actionsQuery.data?.data || [], [actionsQuery.data]);
  const features = useMemo(() => featuresQuery.data?.data || [], [featuresQuery.data]);
  const permissions = useMemo(() => permissionsQuery.data?.data || [], [permissionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);

  const loading =
    (canReadAcl && actionsQuery.isLoading) ||
    (canReadFeatureCatalog && featuresQuery.isLoading) ||
    (canReadAcl && permissionsQuery.isLoading) ||
    (canReadUsers && usersQuery.isLoading) ||
    (canReadInstitutions && institutionsQuery.isLoading);

  const fatalError =
    actionsQuery.error ||
    featuresQuery.error ||
    permissionsQuery.error ||
    usersQuery.error ||
    institutionsQuery.error;

  const model = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const userById = new Map(users.map((item) => [item.id, item]));
    const featureById = new Map(features.map((item) => [item.id, item]));
    const actionById = new Map(actions.map((item) => [item.id, item]));
    const institutionById = new Map(institutions.map((item) => [item.id, item]));

    const permissionRows = permissions.map((item) => {
      const actor = userById.get(item.userId);
      const feature = featureById.get(item.featureId);
      const action = actionById.get(item.actionId);
      const institution = item.educationalCenterId ? institutionById.get(item.educationalCenterId) : undefined;
      const scopeLabel = formatScopeLabel(item.educationalCenterId, institution?.name);
      const signal = !actor || !feature || !action ? "referencia incompleta" : item.educationalCenterId ? "scope institucional" : "global";

      return {
        id: item.id,
        userName: actor?.fullName || "Usuario no resuelto",
        userEmail: actor?.email || item.userId,
        roleSummary: actor?.roles.length ? actor.roles.join(", ") : "sin rol",
        featureCode: feature?.code || item.featureId,
        actionCode: action?.code || item.actionId,
        scopeId: item.educationalCenterId || null,
        scopeLabel,
        signal,
        hasReferenceGap: !actor || !feature || !action,
        searchText: [
          actor?.fullName,
          actor?.email,
          feature?.code,
          action?.code,
          scopeLabel,
          signal,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

    const filteredPermissionRows = permissionRows.filter((item) => {
      if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
      if (featureFilter !== "all" && item.featureCode !== featureFilter) return false;
      if (actionFilter !== "all" && item.actionCode !== actionFilter) return false;
      if (scopeFilter === "global" && item.scopeId) return false;
      if (scopeFilter !== "all" && scopeFilter !== "global" && item.scopeId !== scopeFilter) return false;
      if (signalFilter !== "all" && item.signal !== signalFilter) return false;
      return true;
    });

    const reviewProfiles = users
      .filter((item) => item.roles.length === 0 || item.permissions.length > 0)
      .map((item) => {
        const institution = item.educationalCenterId ? institutionById.get(item.educationalCenterId) : undefined;
        const signal = item.roles.length === 0 ? "sin rol" : item.permissions.length > 0 ? "override explícito" : "revisar";
        return {
          id: item.id,
          fullName: item.fullName,
          email: item.email,
          institutionLabel: formatScopeLabel(item.educationalCenterId, institution?.name),
          roles: item.roles,
          permissions: item.permissions,
          signal,
          searchText: [item.fullName, item.email, institution?.name, item.roles.join(" "), item.permissions.join(" "), signal]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        };
      });

    const filteredReviewProfiles = reviewProfiles
      .filter((item) => {
        if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
        if (scopeFilter === "global" && item.institutionLabel !== "Global") return false;
        if (scopeFilter !== "all" && scopeFilter !== "global") {
          const institution = institutionById.get(scopeFilter);
          if (item.institutionLabel !== formatScopeLabel(scopeFilter, institution?.name)) return false;
        }
        if (signalFilter === "sin rol" && item.signal !== "sin rol") return false;
        if (signalFilter === "override explícito" && item.signal !== "override explícito") return false;
        return true;
      })
      .slice(0, 12);

    return {
      explicitPermissionUsers: new Set(permissions.map((item) => item.userId)).size,
      scopedPermissions: permissions.filter((item) => item.educationalCenterId).length,
      globalPermissions: permissions.filter((item) => !item.educationalCenterId).length,
      missingReferences: permissionRows.filter((item) => item.hasReferenceGap).length,
      permissionRows: filteredPermissionRows,
      reviewProfiles: filteredReviewProfiles,
      allPermissionRows: permissionRows,
      availableScopes: [
        { value: "global", label: "Global" },
        ...institutions.map((item) => ({ value: item.id, label: item.name })),
      ],
      availableSignals: Array.from(new Set(permissionRows.map((item) => item.signal))),
    };
  }, [actions, featureFilter, features, institutions, permissions, query, scopeFilter, signalFilter, actionFilter, users]);

  const canRenderGovernance = canReadAcl && canReadFeatureCatalog;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionAdminView ? "Institution admin" : "Superadmin"}
        title="Permisos"
        description={
          isInstitutionAdminView
            ? "Vista acotada por alcance institucional. Lee el catálogo ACL disponible para tu sesión y muestra overrides dentro del alcance que el backend te expone."
            : "Esta pantalla ya usa el catálogo real de actions, features y permisos explícitos para leer la gobernanza efectiva del sistema."
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted-foreground">
          <Badge variant={isInstitutionAdminView ? "secondary" : "warning"}>
            {isInstitutionAdminView ? "lectura institucional" : "gobernanza global"}
          </Badge>
          <Badge variant={canReadAcl ? "secondary" : "outline"}>{canReadAcl ? "ACL legible" : "ACL bloqueada"}</Badge>
          <Badge variant={canReadFeatureCatalog ? "secondary" : "outline"}>
            {canReadFeatureCatalog ? "features legibles" : "features bloqueadas"}
          </Badge>
          <span>
            {isInstitutionAdminView
              ? "Si tu sesión no recibe permisos ACL/feature de lectura, el módulo queda visible pero no intenta pedir datos fuera de alcance."
              : "La pantalla ya está consolidada como lectura operativa del contrato ACL compartido entre dashboard y backend."}
          </span>
        </CardContent>
      </Card>

      {!canRenderGovernance ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Lectura ACL no disponible para esta sesión</CardTitle>
            <CardDescription>
              Esta vista necesita al menos lectura sobre access-control y feature. El módulo quedó preparado para institution-admin, pero solo se activa cuando el backend expone esos permisos en la sesión actual.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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
              Acciones, features y volumen real de overrides. Esto ya sirve para validar el backend, no solo para explicar el modelo.
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
                {currentPermissions.length ? currentPermissions.map((permission) => (
                  <Badge key={permission} variant="outline">{permission}</Badge>
                )) : <Badge variant="outline">sin permisos explícitos</Badge>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Perfiles sin rol</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {loading || !canReadUsers ? "-" : String(users.filter((item) => item.roles.length === 0).length)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Referencias rotas</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "-" : String(model.missingReferences)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Filtros operativos</CardTitle>
          <CardDescription>
            Primero filtros, después lectura acotada. Así la pantalla empieza a servir como mesa de trabajo real sobre ACL.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="permissions-query">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="permissions-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Usuario, feature, action, scope o señal"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-feature-filter">Feature</Label>
            <SelectField id="permissions-feature-filter" value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)}>
              <option value="all">Todas</option>
              {features.map((feature) => (
                <option key={feature.id} value={feature.code}>{feature.code}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-action-filter">Action</Label>
            <SelectField id="permissions-action-filter" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              <option value="all">Todas</option>
              {actions.map((action) => (
                <option key={action.id} value={action.code}>{action.code}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-scope-filter">Scope</Label>
            <SelectField id="permissions-scope-filter" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
              <option value="all">Todos</option>
              {model.availableScopes.map((scope) => (
                <option key={scope.value} value={scope.value}>{scope.label}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-signal-filter">Señal</Label>
            <SelectField id="permissions-signal-filter" value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)}>
              <option value="all">Todas</option>
              <option value="sin rol">sin rol</option>
              <option value="override explícito">override explícito</option>
              {model.availableSignals.map((signal) => (
                <option key={signal} value={signal}>{signal}</option>
              ))}
            </SelectField>
          </div>
        </CardContent>
      </Card>

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
            Tabla filtrable para cruzar usuario, feature, action y scope institucional sin salir del dashboard.
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
                      No hay overrides que coincidan con los filtros actuales.
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
                          <Badge variant="outline">{row.signal}</Badge>
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
            Usuarios sin rol o con overrides explícitos, para que el módulo también funcione como cola de revisión.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : !canReadUsers ? (
            <div className="p-6 text-sm leading-6 text-muted-foreground">
              La sesión actual puede leer ACL, pero no expone lectura de usuarios suficiente para construir esta cola de revisión.
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
                      No hay perfiles marcados para revisión con los filtros actuales.
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
