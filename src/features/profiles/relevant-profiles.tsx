"use client";

import { useMemo } from "react";
import { Building2, ShieldCheck, UserRound, Users } from "lucide-react";
import { ApiError } from "@/lib/api/fetcher";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
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
  icon: React.ComponentType<{ className?: string }>;
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
  const { tokens, user } = useAuth();
  const usersQuery = useUsers(tokens?.accessToken);

  const backendUnavailable =
    usersQuery.error instanceof ApiError && [404, 405].includes(usersQuery.error.status);

  const metrics = useMemo(() => {
    const users = usersQuery.data?.data || [];
    const adminProfiles = users.filter((item) => item.roles.includes("admin")).length;
    const linkedToInstitution = users.filter((item) => item.educationalCenterId).length;
    const withoutExplicitPermissions = users.filter((item) => item.permissions.length === 0).length;

    return {
      totalProfiles: usersQuery.data?.total || users.length,
      adminProfiles,
      linkedToInstitution,
      withoutExplicitPermissions,
      spotlightProfiles: users.filter((item) => item.roles.includes("admin") || item.permissions.length > 0).slice(0, 8),
    };
  }, [usersQuery.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Perfiles relevantes"
        description="Una lectura más curada que la tabla de usuarios: foco en perfiles clave, vínculos institucionales y señales de configuración que conviene revisar."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {usersQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Perfiles visibles"
              value={backendUnavailable ? "Pendiente" : String(metrics.totalProfiles)}
              hint="Base inicial para identificar actores clave del sistema."
              icon={Users}
            />
            <SummaryCard
              label="Perfiles admin"
              value={backendUnavailable ? "Pendiente" : String(metrics.adminProfiles)}
              hint="Perfiles con mayor impacto operativo sobre la plataforma." 
              icon={ShieldCheck}
            />
            <SummaryCard
              label="Vinculados a institución"
              value={backendUnavailable ? "Pendiente" : String(metrics.linkedToInstitution)}
              hint="Ayuda a detectar si el mapa institucional está bien asociado." 
              icon={Building2}
            />
            <SummaryCard
              label="Sin permisos explícitos"
              value={backendUnavailable ? "Pendiente" : String(metrics.withoutExplicitPermissions)}
              hint="Útil para revisar herencia de roles y huecos de configuración." 
              icon={UserRound}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Qué entendemos por perfil relevante</CardTitle>
            <CardDescription>
              No todos los usuarios importan por igual para operación. Esta vista quiere resaltar los que conviene mirar primero.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Perfiles con acceso alto</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Admins y perfiles con permisos explícitos que modifican la operación.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Perfiles institucionales críticos</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Usuarios clave para entender propiedad, alcance y responsabilidades por cliente.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Huecos de configuración</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Usuarios sin institución, sin permisos o con combinaciones que merecen revisión.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Perfil autenticado actual</CardTitle>
            <CardDescription>
              Sigue siendo útil dejar visible el punto de vista real desde el que estás navegando el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{user?.fullName || "Sin nombre"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || "Sin email"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Roles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user?.roles.length ? user.roles.map((role) => (
                  <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                )) : <Badge variant="outline">sin roles</Badge>}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Permisos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user?.permissions.length ? user.permissions.map((permission) => (
                  <Badge key={permission} variant="outline">{permission}</Badge>
                )) : <Badge variant="outline">sin permisos explícitos</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Perfiles destacados para revisión</CardTitle>
          <CardDescription>
            Priorizamos admins y usuarios con permisos explícitos porque suelen ser los más sensibles desde el punto de vista operativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {usersQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : backendUnavailable ? (
            <div className="space-y-3 p-6 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">El backend todavía no expone el listado de usuarios necesario para construir esta vista viva.</p>
              <p>
                Aun así, la estructura ya quedó montada para que puedas navegar el módulo, validar la jerarquía del front y probar el comportamiento por rol.
              </p>
            </div>
          ) : usersQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(usersQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.spotlightProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No hay perfiles destacados para mostrar todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.spotlightProfiles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{item.fullName}</p>
                          <p className="text-xs text-muted-foreground">{item.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.roles.length ? item.roles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                          )) : <Badge variant="outline">sin rol</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.permissions.length ? (
                          <div className="flex flex-wrap gap-2">
                            {item.permissions.map((permission) => (
                              <Badge key={permission} variant="outline">{permission}</Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline">sin permisos explícitos</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.educationalCenterId || "-"}</TableCell>
                      <TableCell>{item.userType || "-"}</TableCell>
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
