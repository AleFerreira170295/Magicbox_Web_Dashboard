"use client";

import { useMemo } from "react";
import { Building2, KeyRound, Layers3, ShieldCheck, ShieldEllipsis, Users } from "lucide-react";
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

const permissionBundles = [
  {
    role: "admin",
    scope: "global",
    capabilities: ["usuarios", "permisos", "instituciones", "salud", "configuración"],
    emphasis: "warning" as const,
  },
  {
    role: "director",
    scope: "institución",
    capabilities: ["lectura institucional", "usuarios de su institución", "dispositivos", "syncs"],
    emphasis: "secondary" as const,
  },
  {
    role: "teacher",
    scope: "aula / grupo",
    capabilities: ["dashboard pedagógico", "partidas", "dispositivos asignados"],
    emphasis: "secondary" as const,
  },
  {
    role: "family",
    scope: "perfil asociado",
    capabilities: ["lectura restringida", "seguimiento básico"],
    emphasis: "outline" as const,
  },
  {
    role: "researcher",
    scope: "datasets controlados",
    capabilities: ["analytics", "consultas acotadas", "anonimización"],
    emphasis: "outline" as const,
  },
];

const capabilitiesMatrix = [
  {
    capability: "Gestionar usuarios",
    roles: ["admin"],
  },
  {
    capability: "Gestionar permisos",
    roles: ["admin"],
  },
  {
    capability: "Ver instituciones",
    roles: ["admin", "director"],
  },
  {
    capability: "Ver salud operativa global",
    roles: ["admin"],
  },
  {
    capability: "Ver datos pedagógicos",
    roles: ["admin", "director", "teacher", "researcher"],
  },
  {
    capability: "Acceder a datos familiares",
    roles: ["family"],
  },
];

const permissionLayers = [
  {
    title: "Rol base",
    description: "El primer nivel de acceso. Define el paquete de capacidades esperables por tipo de perfil.",
    icon: ShieldCheck,
  },
  {
    title: "Scope institucional",
    description: "Restringe o amplía alcance según cliente, institución o contexto operativo asociado.",
    icon: Building2,
  },
  {
    title: "Permisos explícitos",
    description: "Permiten ajustes finos por usuario cuando el bundle por rol no alcanza.",
    icon: KeyRound,
  },
  {
    title: "Overrides y auditoría",
    description: "Excepciones controladas y trazables para resolver situaciones operativas sin perder gobernanza.",
    icon: ShieldEllipsis,
  },
];

export function PermissionsCenter() {
  const { tokens, user } = useAuth();
  const usersQuery = useUsers(tokens?.accessToken);

  const backendUnavailable =
    usersQuery.error instanceof ApiError && [404, 405].includes(usersQuery.error.status);

  const metrics = useMemo(() => {
    const users = usersQuery.data?.data || [];
    const explicitPermissionsUsers = users.filter((item) => item.permissions.length > 0).length;
    const institutionsReferenced = new Set(
      users.map((item) => item.educationalCenterId).filter(Boolean),
    ).size;
    const adminsWithoutInstitution = users.filter(
      (item) => item.roles.includes("admin") && !item.educationalCenterId,
    ).length;
    const usersWithoutRoles = users.filter((item) => item.roles.length === 0).length;

    return {
      totalRolesModeled: permissionBundles.length,
      currentPermissions: user?.permissions.length || 0,
      explicitPermissionsUsers,
      institutionsReferenced,
      adminsWithoutInstitution,
      usersWithoutRoles,
      reviewProfiles: users
        .filter(
          (item) => item.roles.includes("admin") || item.permissions.length > 0 || item.roles.length === 0,
        )
        .slice(0, 10),
    };
  }, [user?.permissions.length, usersQuery.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Permisos"
        description="Esta versión ya piensa los permisos como un sistema de gobernanza: bundles por rol, herencia por scope, permisos explícitos y perfiles que necesitan revisión."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {usersQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Bundles modelados"
              value={String(metrics.totalRolesModeled)}
              hint="Roles base que organizan la gobernanza inicial del sistema."
              icon={ShieldCheck}
            />
            <SummaryCard
              label="Permisos de tu sesión"
              value={String(metrics.currentPermissions)}
              hint="Permisos explícitos visibles en la cuenta autenticada actual."
              icon={KeyRound}
            />
            <SummaryCard
              label="Usuarios con permisos explícitos"
              value={backendUnavailable ? "Pendiente" : String(metrics.explicitPermissionsUsers)}
              hint="Se completa automáticamente cuando el backend expone `/users`."
              icon={Users}
            />
            <SummaryCard
              label="Admins sin institución"
              value={backendUnavailable ? "Pendiente" : String(metrics.adminsWithoutInstitution)}
              hint="Un buen detector de cuentas globales o huecos de configuración."
              icon={Building2}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Capas del modelo de permisos</CardTitle>
            <CardDescription>
              La clave es que la pantalla ya explique cómo se construye el acceso efectivo, no solo qué rol tiene cada usuario.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {permissionLayers.map((layer) => {
              const Icon = layer.icon;
              return (
                <div key={layer.title} className="rounded-2xl bg-white/80 p-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-primary/12 p-2 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{layer.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{layer.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Sesión actual y lectura rápida</CardTitle>
            <CardDescription>
              Mantener visible tu contexto actual ayuda a probar la UX y también a interpretar el resto del módulo.
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
              <p className="text-sm font-medium text-foreground">Permisos explícitos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user?.permissions.length ? user.permissions.map((permission) => (
                  <Badge key={permission} variant="outline">{permission}</Badge>
                )) : <Badge variant="outline">sin permisos explícitos</Badge>}
              </div>
            </div>
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              Esta pantalla ya está preparada para evolucionar a un verdadero editor de políticas, con scopes por institución y overrides por usuario.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Bundles por rol</CardTitle>
          <CardDescription>
            Una primera tabla de paquetes de acceso para que la gobernanza sea entendible incluso antes de tener un backend fino de permisos.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Capacidades principales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionBundles.map((bundle) => (
                <TableRow key={bundle.role}>
                  <TableCell>
                    <Badge variant={bundle.emphasis}>{bundle.role}</Badge>
                  </TableCell>
                  <TableCell>{bundle.scope}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {bundle.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline">{capability}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers3 className="size-5 text-primary" />
            <CardTitle>Matriz base de capacidades</CardTitle>
          </div>
          <CardDescription>
            Un paso más allá del badge de rol: qué capacidades se esperan para cada bundle principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Capacidad</TableHead>
                <TableHead>Roles esperados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capabilitiesMatrix.map((row) => (
                <TableRow key={row.capability}>
                  <TableCell className="font-medium">{row.capability}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {row.roles.map((role) => (
                        <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Perfiles que conviene revisar</CardTitle>
          <CardDescription>
            Esta parte hace que el módulo empiece a ser operativo: no solo muestra modelo, también señala dónde mirar primero.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {usersQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : backendUnavailable ? (
            <div className="space-y-3 p-6 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">El backend todavía no expone el listado de usuarios para construir una revisión viva de perfiles.</p>
              <p>
                Igual la estructura ya quedó lista para integrar revisiones operativas por rol, scope institucional y permisos explícitos apenas exista el endpoint.
              </p>
            </div>
          ) : usersQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(usersQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Señal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.reviewProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No hay perfiles a revisar todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  metrics.reviewProfiles.map((item) => {
                    const signal = item.roles.length === 0
                      ? "sin rol"
                      : item.roles.includes("admin") && !item.educationalCenterId
                        ? "admin global o sin scope"
                        : item.permissions.length > 0
                          ? "permiso explícito"
                          : "revisar";

                    return (
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
                        <TableCell>
                          <Badge variant="secondary">{signal}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
