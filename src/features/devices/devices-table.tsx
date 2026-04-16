"use client";

import { useMemo, useState } from "react";
import { Cpu, Search, ShieldCheck, Smartphone, UserRound, Wifi } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useInstitutions } from "@/features/institutions/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

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

function statusLabel(status?: string | null) {
  if (!status) return "sin estado";
  return status.replaceAll("_", " ");
}

export function DevicesTable() {
  const { tokens, user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveInstitutionFilter = institutionFilter === "all" && scopedInstitutionId ? scopedInstitutionId : institutionFilter;

    return devices.filter((device) => {
      if (effectiveInstitutionFilter !== "all" && device.educationalCenterId !== effectiveInstitutionFilter) return false;
      if (!normalized) return true;

      return [
        device.deviceId,
        device.name,
        device.educationalCenterName,
        device.ownerUserName,
        device.ownerUserEmail,
        device.firmwareVersion,
        device.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [devices, institutionFilter, query, scopedInstitutionId]);

  const selectedDevice = useMemo(
    () => filtered.find((device) => device.id === selectedDeviceId) || devices.find((device) => device.id === selectedDeviceId) || null,
    [devices, filtered, selectedDeviceId],
  );

  const metrics = useMemo(() => {
    const onlineDevices = devices.filter((device) => (device.status || "").toLowerCase().includes("online")).length;
    const devicesWithOwner = devices.filter((device) => Boolean(device.ownerUserId)).length;
    const devicesWithFirmware = devices.filter((device) => Boolean(device.firmwareVersion)).length;
    const devicesWithMetadata = devices.filter((device) => Object.keys(device.deviceMetadata || {}).length > 0).length;

    return {
      total: devices.length,
      onlineDevices,
      devicesWithOwner,
      devicesWithFirmware,
      devicesWithMetadata,
    };
  }, [devices]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? "Institution admin" : "Operación"}
        title="Dispositivos"
        description={
          isInstitutionScopedView
            ? `Vista operativa de hardware para ${scopedInstitutionName}. Ya refleja el contrato real de /ble-device.`
            : "Pantalla operativa de hardware conectada al contrato real de /ble-device, con contexto institucional y de ownership."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por deviceId, nombre, institución o responsable"
                className="pl-9"
              />
            </div>
            <select
              value={institutionFilter}
              onChange={(event) => setInstitutionFilter(event.target.value)}
              className="h-10 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
              disabled={Boolean(scopedInstitutionId)}
            >
              <option value="all">Todas las instituciones</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
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
                {isInstitutionScopedView ? "institution-admin" : "multi-institución / global"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              El backend ahora expone nombre de institución, ownership real, firmware, status y metadata del dispositivo en `/ble-device`.
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {devicesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Dispositivos" value={String(metrics.total)} hint="Inventario visible según ACL real." icon={Smartphone} />
            <SummaryCard label="Online" value={String(metrics.onlineDevices)} hint="Lectura rápida del parque activo." icon={Wifi} />
            <SummaryCard label="Con responsable" value={String(metrics.devicesWithOwner)} hint="Ownership ya resuelto desde backend." icon={UserRound} />
            <SummaryCard label="Con firmware" value={String(metrics.devicesWithFirmware)} hint="Útil para QA de compatibilidad app/hardware." icon={Cpu} />
            <SummaryCard label="Con metadata" value={String(metrics.devicesWithMetadata)} hint="Ayuda a ver qué tan enriquecido viene cada sync/dispositivo." icon={ShieldCheck} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Parque de dispositivos</CardTitle>
            <CardDescription>
              Seleccioná un dispositivo para revisar ownership, firmware, status y metadata útil para soporte manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {devicesQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : devicesQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(devicesQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No hay dispositivos para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((device) => (
                      <TableRow
                        key={device.id}
                        className={cn("cursor-pointer", selectedDeviceId === device.id && "bg-primary/5")}
                        onClick={() => setSelectedDeviceId(device.id)}
                      >
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                        <TableCell>{device.educationalCenterName || device.educationalCenterId || "-"}</TableCell>
                        <TableCell>{device.ownerUserName || device.ownerUserEmail || "sin responsable"}</TableCell>
                        <TableCell>
                          <Badge variant={device.status ? "secondary" : "outline"}>{statusLabel(device.status)}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(device.updatedAt)}</TableCell>
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
            <CardTitle>Detalle operativo</CardTitle>
            <CardDescription>
              Este panel usa el contrato enriquecido de `/ble-device` para validar manualmente lo que realmente persiste en backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedDevice ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí un dispositivo para revisar su contexto operativo.
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedDevice.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedDevice.deviceId}</p>
                    </div>
                    <Badge variant={selectedDevice.status ? "secondary" : "outline"}>{statusLabel(selectedDevice.status)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Institución: {selectedDevice.educationalCenterName || selectedDevice.educationalCenterId || "-"}</p>
                    <p>Firmware: {selectedDevice.firmwareVersion || "sin firmware"}</p>
                    <p>Responsable: {selectedDevice.ownerUserName || "sin responsable"}</p>
                    <p>Actualizado: {formatDateTime(selectedDevice.updatedAt)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Ownership</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDevice.ownerUserName ? <Badge variant="secondary">{selectedDevice.ownerUserName}</Badge> : <Badge variant="outline">sin owner asignado</Badge>}
                    {selectedDevice.ownerUserEmail ? <Badge variant="outline">{selectedDevice.ownerUserEmail}</Badge> : null}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Metadata cruda</p>
                  <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedDevice.deviceMetadata || {}, null, 2)}</pre>
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
