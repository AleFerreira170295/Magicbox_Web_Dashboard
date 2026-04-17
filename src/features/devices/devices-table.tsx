"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Home, Search, ShieldCheck, Smartphone, University, UserRound, Wifi } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { updateDevice, useDevices } from "@/features/devices/api";
import type { DeviceRecord, UpdateDevicePayload } from "@/features/devices/types";
import { useInstitutions } from "@/features/institutions/api";
import { useUsers } from "@/features/users/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

type DeviceFormState = {
  name: string;
  assignmentScope: "home" | "institution";
  educationalCenterId: string;
  ownerUserId: string;
  firmwareVersion: string;
  status: string;
};

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

function scopeBadge(device: { assignmentScope: "home" | "institution"; educationalCenterName?: string | null }) {
  if (device.assignmentScope === "home") return <Badge variant="secondary">Home</Badge>;
  return <Badge variant="outline">{device.educationalCenterName || "Institución"}</Badge>;
}

function locationLabel(device: {
  assignmentScope: "home" | "institution";
  educationalCenterName?: string | null;
  educationalCenterId?: string | null;
}) {
  if (device.assignmentScope === "home") return "Home";
  return device.educationalCenterName || device.educationalCenterId || "Institución";
}

function buildFormState(device: DeviceRecord | null, scopedInstitutionId?: string | null): DeviceFormState {
  if (!device) {
    return {
      name: "",
      assignmentScope: scopedInstitutionId ? "institution" : "home",
      educationalCenterId: scopedInstitutionId || "",
      ownerUserId: "",
      firmwareVersion: "",
      status: "",
    };
  }

  return {
    name: device.name,
    assignmentScope: device.assignmentScope,
    educationalCenterId: device.educationalCenterId || scopedInstitutionId || "",
    ownerUserId: device.ownerUserId || "",
    firmwareVersion: device.firmwareVersion || "",
    status: device.status || "",
  };
}

function DeviceEditorPanel({
  selectedDevice,
  scopedInstitutionId,
  institutions,
  users,
  token,
  canUpdateDevices,
  onUpdated,
}: {
  selectedDevice: DeviceRecord;
  scopedInstitutionId?: string | null;
  institutions: Array<{ id: string; name: string }>;
  users: Array<{ id: string; fullName: string; email: string; educationalCenterId?: string | null }>;
  token?: string;
  canUpdateDevices: boolean;
  onUpdated: (deviceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<DeviceFormState>(() => buildFormState(selectedDevice, scopedInstitutionId));
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const assignmentLockedToInstitution = Boolean(scopedInstitutionId);
  const availableOwners = useMemo(() => {
    if (formState.assignmentScope === "home") return users;
    if (!formState.educationalCenterId) return users;
    return users.filter((user) => !user.educationalCenterId || user.educationalCenterId === formState.educationalCenterId);
  }, [formState.assignmentScope, formState.educationalCenterId, users]);

  const updateDeviceMutation = useMutation({
    mutationFn: async (payload: UpdateDevicePayload) => {
      if (!token || !selectedDevice) throw new Error("No hay dispositivo seleccionado.");
      return updateDevice(token, selectedDevice.id, payload);
    },
    onSuccess: async (updatedDevice) => {
      setFeedback({ tone: "success", text: "Dispositivo actualizado correctamente." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["institutions"] }),
      ]);
      onUpdated(updatedDevice.id);
    },
    onError: (error) => {
      setFeedback({ tone: "error", text: getErrorMessage(error) });
    },
  });

  const handleFieldChange = <K extends keyof DeviceFormState>(key: K, value: DeviceFormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedDevice) {
      setFeedback({ tone: "error", text: "Seleccioná un dispositivo primero." });
      return;
    }

    if (!canUpdateDevices) {
      setFeedback({ tone: "error", text: "Tu acceso actual no permite editar dispositivos." });
      return;
    }

    if (!formState.name.trim()) {
      setFeedback({ tone: "error", text: "El nombre es obligatorio." });
      return;
    }

    if (formState.assignmentScope === "institution" && !formState.educationalCenterId) {
      setFeedback({ tone: "error", text: "Elegí una institución para el dispositivo." });
      return;
    }

    await updateDeviceMutation.mutateAsync({
      name: formState.name.trim(),
      educationalCenterId: formState.assignmentScope === "home" ? null : formState.educationalCenterId,
      ownerUserId: formState.ownerUserId || null,
      firmwareVersion: formState.firmwareVersion || null,
      status: formState.status || null,
    });
  };

  return (
    <>
      <div className="rounded-2xl bg-background/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedDevice.name}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedDevice.deviceId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {scopeBadge(selectedDevice)}
            <Badge variant={selectedDevice.status ? "secondary" : "outline"}>{statusLabel(selectedDevice.status)}</Badge>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            Ubicación actual: {selectedDevice.assignmentScope === "home" ? "Home, sin centro educativo asociado" : locationLabel(selectedDevice)}
          </p>
          <p>Actualizado: {formatDateTime(selectedDevice.updatedAt)}</p>
          <p>Owner actual: {selectedDevice.ownerUserName || selectedDevice.ownerUserEmail || "sin owner"}</p>
          <p>Firmware actual: {selectedDevice.firmwareVersion || "sin firmware"}</p>
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            feedback.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700",
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-foreground">Nombre</label>
          <Input value={formState.name} onChange={(event) => handleFieldChange("name", event.target.value)} disabled={!canUpdateDevices} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Alcance</label>
          <select
            value={formState.assignmentScope}
            onChange={(event) => handleFieldChange("assignmentScope", event.target.value as "home" | "institution")}
            disabled={assignmentLockedToInstitution || !canUpdateDevices}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="home">Home</option>
            <option value="institution">Institución</option>
          </select>
          {assignmentLockedToInstitution ? (
            <p className="text-xs text-muted-foreground">Tu vista está anclada a una única institución, así que no podés mover este dispositivo a Home desde aquí.</p>
          ) : !canUpdateDevices ? (
            <p className="text-xs text-muted-foreground">Tu acceso actual es de solo lectura para dispositivos.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Institución</label>
          <select
            value={formState.educationalCenterId}
            onChange={(event) => handleFieldChange("educationalCenterId", event.target.value)}
            disabled={formState.assignmentScope === "home" || !canUpdateDevices}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Seleccionar institución</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Responsable</label>
          <select
            value={formState.ownerUserId}
            onChange={(event) => handleFieldChange("ownerUserId", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={!canUpdateDevices}
          >
            <option value="">Sin owner</option>
            {availableOwners.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} · {user.email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Status</label>
          <Input value={formState.status} onChange={(event) => handleFieldChange("status", event.target.value)} placeholder="online, offline, active..." disabled={!canUpdateDevices} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-foreground">Firmware</label>
          <Input value={formState.firmwareVersion} onChange={(event) => handleFieldChange("firmwareVersion", event.target.value)} placeholder="V2.2" disabled={!canUpdateDevices} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
        <div>
          {formState.assignmentScope === "home"
            ? "Home es un caso válido. El dispositivo quedará sin centro educativo asociado."
            : "En modo institución, el dispositivo debe quedar asociado a un centro concreto."}
        </div>
        <Button onClick={handleSubmit} disabled={updateDeviceMutation.isPending || !canUpdateDevices}>
          {updateDeviceMutation.isPending ? "Guardando..." : canUpdateDevices ? "Guardar cambios" : "Edición bloqueada"}
        </Button>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Metadata cruda</p>
        <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
          <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedDevice.deviceMetadata || {}, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}

export function DevicesTable() {
  const { tokens, user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "home" | "institution">("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);

  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);

  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canUpdateDevices = hasAnyPermission("ble_device:update", "ble-device:update");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveInstitutionFilter = institutionFilter === "all" && scopedInstitutionId ? scopedInstitutionId : institutionFilter;

    return devices.filter((device) => {
      if (scopeFilter !== "all" && device.assignmentScope !== scopeFilter) return false;
      if (
        effectiveInstitutionFilter !== "all" &&
        (device.assignmentScope !== "institution" || device.educationalCenterId !== effectiveInstitutionFilter)
      ) {
        return false;
      }
      if (!normalized) return true;

      return [
        device.deviceId,
        device.name,
        device.assignmentScope === "home" ? "home" : device.educationalCenterName,
        device.ownerUserName,
        device.ownerUserEmail,
        device.firmwareVersion,
        device.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [devices, institutionFilter, query, scopeFilter, scopedInstitutionId]);

  const selectedDevice = useMemo(
    () => filtered.find((device) => device.id === selectedDeviceId) || devices.find((device) => device.id === selectedDeviceId) || null,
    [devices, filtered, selectedDeviceId],
  );

  const metrics = useMemo(() => {
    const onlineDevices = devices.filter((device) => (device.status || "").toLowerCase().includes("online")).length;
    const homeDevices = devices.filter((device) => device.assignmentScope === "home").length;
    const institutionDevices = devices.filter((device) => device.assignmentScope === "institution").length;
    const devicesWithOwner = devices.filter((device) => Boolean(device.ownerUserId)).length;
    const devicesWithMetadata = devices.filter((device) => Object.keys(device.deviceMetadata || {}).length > 0).length;

    return {
      total: devices.length,
      onlineDevices,
      homeDevices,
      institutionDevices,
      devicesWithOwner,
      devicesWithMetadata,
    };
  }, [devices]);

  const institutionFilterDisabled = Boolean(scopedInstitutionId) || scopeFilter === "home";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? "Institution admin" : "Operación"}
        title="Dispositivos"
        description={
          isInstitutionScopedView
            ? `Vista operativa de hardware para ${scopedInstitutionName}, con edición controlada para ownership, alcance y estado.`
            : "Pantalla operativa de hardware conectada al contrato real de /ble-device, distinguiendo dispositivos Home y de institución."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:flex-wrap">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filtrar por deviceId, nombre, Home, institución o responsable"
                className="pl-9"
              />
            </div>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as "all" | "home" | "institution")}
              className="h-10 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos los alcances</option>
              <option value="home">Solo Home</option>
              <option value="institution">Solo institución</option>
            </select>
            <select
              value={institutionFilter}
              onChange={(event) => setInstitutionFilter(event.target.value)}
              className="h-10 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
              disabled={institutionFilterDisabled}
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
              <Badge variant="secondary">Home explícito</Badge>
              <Badge variant={canUpdateDevices ? "secondary" : "outline"}>{canUpdateDevices ? "edición habilitada" : "solo lectura"}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {canUpdateDevices
                ? "Además de distinguir Home vs institución, ahora esta pantalla puede persistir nombre, owner, firmware, estado y cambio de alcance cuando el backend lo permite."
                : "La sesión actual puede revisar el parque visible por ACL, pero no editar dispositivos sin permiso explícito de actualización."}
            </p>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {devicesQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Dispositivos" value={String(metrics.total)} hint="Inventario visible según ACL real." icon={Smartphone} />
            <SummaryCard label="Home" value={String(metrics.homeDevices)} hint="Sin centro educativo asociado, por diseño." icon={Home} />
            <SummaryCard label="Institución" value={String(metrics.institutionDevices)} hint="Asignados a una institución concreta." icon={University} />
            <SummaryCard label="Online" value={String(metrics.onlineDevices)} hint="Lectura rápida del parque activo." icon={Wifi} />
            <SummaryCard label="Con responsable" value={String(metrics.devicesWithOwner)} hint="Ownership ya resuelto desde backend." icon={UserRound} />
            <SummaryCard label="Con metadata" value={String(metrics.devicesWithMetadata)} hint="Ayuda a soporte y QA manual." icon={ShieldCheck} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1.05fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Parque de dispositivos</CardTitle>
            <CardDescription>
              Seleccioná un dispositivo para revisar y editar su alcance, ownership y estado operativo.
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
                    <TableHead>Alcance</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Estado</TableHead>
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
                        <TableCell>{scopeBadge(device)}</TableCell>
                        <TableCell>{locationLabel(device)}</TableCell>
                        <TableCell>{device.ownerUserName || device.ownerUserEmail || "sin responsable"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={device.status ? "secondary" : "outline"}>{statusLabel(device.status)}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDateTime(device.updatedAt)}</span>
                          </div>
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
            <CardTitle>Detalle y edición</CardTitle>
            <CardDescription>
              Este panel usa mutaciones reales sobre <code>/ble-device/&lt;id&gt;</code> para persistir cambios operativos mínimos sin inventar un flujo paralelo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedDevice ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí un dispositivo para revisar y editar su contexto operativo.
              </div>
            ) : (
              <DeviceEditorPanel
                key={`${selectedDevice.id}:${scopedInstitutionId || "global"}`}
                selectedDevice={selectedDevice}
                scopedInstitutionId={scopedInstitutionId}
                institutions={institutions.map((institution) => ({ id: institution.id, name: institution.name }))}
                users={users.map((user) => ({
                  id: user.id,
                  fullName: user.fullName,
                  email: user.email,
                  educationalCenterId: user.educationalCenterId,
                }))}
                token={tokens?.accessToken}
                canUpdateDevices={canUpdateDevices}
                onUpdated={(deviceId) => setSelectedDeviceId(deviceId)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
