"use client";

import { useMemo } from "react";
import { Building2, MapPin, ShieldCheck, Smartphone, Users } from "lucide-react";
import { ApiError } from "@/lib/api/fetcher";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useInstitutions } from "@/features/institutions/api";
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

export function InstitutionsOverview() {
  const { tokens, user } = useAuth();
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);

  const backendUnavailable =
    institutionsQuery.error instanceof ApiError && [404, 405].includes(institutionsQuery.error.status);

  const metrics = useMemo(() => {
    const institutions = institutionsQuery.data?.data || [];
    const users = usersQuery.data?.data || [];
    const devices = devicesQuery.data?.data || [];
    const institutionIdsFromUsers = new Set(
      users.map((item) => item.educationalCenterId).filter(Boolean),
    );
    const institutionIdsFromDevices = new Set(
      devices.map((item) => item.educationalCenterId).filter(Boolean),
    );

    return {
      totalInstitutions: institutionsQuery.data?.total || institutions.length,
      institutionsReferencedByUsers: institutionIdsFromUsers.size,
      institutionsReferencedByDevices: institutionIdsFromDevices.size,
    };
  }, [devicesQuery.data, institutionsQuery.data, usersQuery.data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Instituciones"
        description="Base para administrar clientes, responsables, contexto operativo y vínculo con usuarios y dispositivos."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {institutionsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Instituciones visibles"
              value={backendUnavailable ? "Pendiente" : String(metrics.totalInstitutions)}
              hint={backendUnavailable ? "La API aún no expone instituciones, pero la UX ya quedó montada." : "Vista base de clientes e instituciones disponibles."}
              icon={Building2}
            />
            <SummaryCard
              label="Instituciones referenciadas por usuarios"
              value={String(metrics.institutionsReferencedByUsers)}
              hint="Sirve para mapear el alcance real de la operación humana." 
              icon={Users}
            />
            <SummaryCard
              label="Instituciones referenciadas por dispositivos"
              value={String(metrics.institutionsReferencedByDevices)}
              hint="Ayuda a cruzar despliegue físico y configuración operativa." 
              icon={Smartphone}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>En qué debería ayudarte este módulo</CardTitle>
            <CardDescription>
              La idea es que aquí puedas entender cada institución como unidad operativa, no solo como un nombre en una tabla.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Responsables y contexto</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Quién administra, quién usa, y qué configuración aplica por institución.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Usuarios y permisos</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Cruzar roles y permisos con el alcance institucional real.</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Dispositivos y salud</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Ver el estado del parque activo y detectar problemas por cliente.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Contexto actual</CardTitle>
            <CardDescription>
              Mientras el backend completa esta capa, dejamos visible al menos la referencia institucional de la sesión y del ecosistema ya cargado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Institución de tu sesión</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.educationalCenterId || "Sin educationalCenterId visible"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Lectura operativa inicial</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Incluso sin endpoint de instituciones, ya podemos empezar a ver referencias institucionales en usuarios y dispositivos para preparar la administración real del sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Listado de instituciones</CardTitle>
          <CardDescription>
            Cuando exista el endpoint, esta tabla debería ser el punto de entrada para navegar responsables, dispositivos, usuarios y salud operativa por cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {institutionsQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : backendUnavailable ? (
            <div className="space-y-3 p-6 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">El backend todavía no expone el listado de instituciones.</p>
              <p>
                La pantalla ya quedó lista para integrarlo apenas exista. Mientras tanto, la estructura front permite seguir probando navegación, permisos y jerarquía de módulos.
              </p>
            </div>
          ) : institutionsQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(institutionsQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institución</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(institutionsQuery.data?.data || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No hay instituciones para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  (institutionsQuery.data?.data || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.code || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <p>{item.contactName || "-"}</p>
                          <p className="text-xs text-muted-foreground">{item.contactEmail || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status ? "success" : "outline"}>{item.status || "sin estado"}</Badge>
                      </TableCell>
                      <TableCell>{[item.city, item.country].filter(Boolean).join(", ") || "-"}</TableCell>
                      <TableCell>{formatDateTime(item.updatedAt || item.createdAt)}</TableCell>
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
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle>Próxima evolución recomendada</CardTitle>
          </div>
          <CardDescription>
            Después de instituciones, el siguiente frente ideal es una vista más global de salud de dispositivos y sincronización por cliente.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
