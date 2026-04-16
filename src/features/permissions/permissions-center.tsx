"use client";

import { useMemo } from "react";
import { Building2, KeyRound, ShieldCheck, Users } from "lucide-react";
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

const roleBlueprint = [
  {
    role: "admin",
    label: "Superadmin / admin global",
    description: "Gestiona usuarios, permisos, instituciones, dispositivos y operación transversal.",
  },
  {
    role: "director",
    label: "Administración institucional",
    description: "Ve datos y contexto de su institución, con capacidad de supervisión interna.",
  },
  {
    role: "teacher",
    label: "Docente",
    description: "Accede al seguimiento pedagógico y operativo acotado a su contexto.",
  },
  {
    role: "family",
    label: "Familia",
    description: "Acceso mínimo y restringido a perfiles o estudiantes asociados.",
  },
  {
    role: "researcher",
    label: "Investigación / análisis",
    description: "Consulta datasets acotados, con criterios de anonimización y trazabilidad.",
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

    return {
      totalRolesModeled: roleBlueprint.length,
      currentPermissions: user?.permissions.length || 0,
      explicitPermissionsUsers,
      institutionsReferenced,
    };
  }, [user?.permissions.length, usersQuery.data?.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Permisos"
        description="Este módulo ordena la gobernanza del sistema: roles, permisos efectivos, alcance por institución y futuras excepciones operativas."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {usersQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Roles modelados"
              value={String(metrics.totalRolesModeled)}
              hint="Base visual inicial para ordenar el sistema de acceso."
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
              label="Instituciones referenciadas"
              value={backendUnavailable ? "Pendiente" : String(metrics.institutionsReferenced)}
              hint="Sirve para entender el alcance real de los accesos."
              icon={Building2}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Matriz base de roles</CardTitle>
            <CardDescription>
              Primera estructura para separar con claridad operación global, administración institucional y acceso pedagógico.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {roleBlueprint.map((item) => (
              <div key={item.role} className="rounded-2xl bg-white/80 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant={item.role === "admin" ? "warning" : "secondary"}>{item.role}</Badge>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Cuenta autenticada actual</CardTitle>
            <CardDescription>
              Mientras llegan endpoints más completos, esta tarjeta deja visible el contexto real de la sesión.
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
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Usuarios con roles y permisos</CardTitle>
          <CardDescription>
            Esta tabla se alimenta del módulo de usuarios. Si el backend todavía no expone `/users`, la pantalla queda estable y documenta el faltante.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {usersQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : backendUnavailable ? (
            <div className="space-y-3 p-6 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">El backend todavía no expone el listado de usuarios para construir una matriz viva de permisos.</p>
              <p>
                La UX ya quedó preparada para mostrar permisos efectivos por usuario, alcance institucional y futuros overrides sin romper cuando la API no está disponible.
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
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usersQuery.data?.data || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No hay usuarios para mostrar todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  (usersQuery.data?.data || []).map((item) => (
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

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Siguiente capa recomendada</CardTitle>
          <CardDescription>
            Después de este módulo, la pieza natural es instituciones, para poder cruzar permisos, responsables y alcance operativo por cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
            Recomendación: una vez abierto el módulo de instituciones, conviene volver a esta pantalla para introducir <strong>scopes</strong>, herencia de permisos y excepciones por institución o perfil.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
