"use client";

import { useMemo, useState } from "react";
import { Building2, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { ApiError } from "@/lib/api/fetcher";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useUsers } from "@/features/users/api";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

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

export function UsersTable() {
  const { tokens, user } = useAuth();
  const [query, setQuery] = useState("");
  const usersQuery = useUsers(tokens?.accessToken);

  const backendUnavailable =
    usersQuery.error instanceof ApiError && [404, 405].includes(usersQuery.error.status);

  const filtered = useMemo(() => {
    const users = usersQuery.data?.data || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((item) =>
      [item.fullName, item.email, item.userType, item.status, item.educationalCenterId, item.roles.join(", ")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, usersQuery.data?.data]);

  const metrics = useMemo(() => {
    const users = usersQuery.data?.data || [];
    const adminCount = users.filter((item) => item.roles.includes("admin")).length;
    const institutionCount = new Set(
      users.map((item) => item.educationalCenterId).filter(Boolean),
    ).size;

    return {
      totalUsers: usersQuery.data?.total || users.length,
      adminCount,
      institutionCount,
    };
  }, [usersQuery.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Usuarios"
        description="Primer módulo operativo para alta, revisión y gestión de usuarios. La experiencia queda preparada para roles, permisos, instituciones y seguimiento de acceso."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por nombre, email, rol o institución"
                className="w-80 pl-9"
              />
            </div>
            <Button type="button" disabled>
              <UserPlus className="size-4" />
              Alta de usuario
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {usersQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Usuarios visibles"
              value={backendUnavailable ? "Pendiente" : String(metrics.totalUsers)}
              hint={backendUnavailable ? "El endpoint todavía no está expuesto, pero la pantalla ya quedó lista." : "Base para gestión centralizada de accesos."}
              icon={Users}
            />
            <SummaryCard
              label="Admins visibles"
              value={backendUnavailable ? "Pendiente" : String(metrics.adminCount)}
              hint="Luego vamos a distinguir superadmin, admins institucionales y otros perfiles." 
              icon={ShieldCheck}
            />
            <SummaryCard
              label="Instituciones referenciadas"
              value={backendUnavailable ? "Pendiente" : String(metrics.institutionCount)}
              hint="Sirve para cruzar usuarios con el mapa institucional y permisos efectivos." 
              icon={Building2}
            />
          </>
        )}
      </div>

      <div className="md:hidden">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por nombre, email, rol o institución"
        />
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="overflow-x-auto p-0">
          {usersQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : backendUnavailable ? (
            <div className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold text-foreground">El backend todavía no expone el listado de usuarios.</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Igual dejé listo el módulo de superadmin para engancharlo apenas exista el endpoint.
                  Cuando la API esté disponible, esta pantalla puede pasar a listar usuarios, roles,
                  permisos, institución y último acceso sin rehacer la UX.
                </p>
              </div>

              <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Cuenta autenticada actual</p>
                <p className="mt-2">{user?.fullName || "Sin nombre"} · {user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {user?.roles.map((role) => (
                    <Badge key={role} variant="secondary">{role}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : usersQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(usersQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No hay usuarios para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.fullName}</TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.roles.length > 0 ? item.roles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                          )) : <Badge variant="outline">sin rol</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.permissions.length > 0 ? (
                          <span className="text-sm text-muted-foreground">{item.permissions.length} permisos</span>
                        ) : (
                          <Badge variant="outline">sin permisos explícitos</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.educationalCenterId || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={item.status ? "success" : "outline"}>{item.status || "sin estado"}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(item.lastLoginAt || item.createdAt)}</TableCell>
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
