"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Home, Search, ShieldCheck, Smartphone, University, UserRound, Wifi } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { updateDevice, useDevices } from "@/features/devices/api";
import type { DeviceRecord, UpdateDevicePayload } from "@/features/devices/types";
import { useGames } from "@/features/games/api";
import { useInstitutions } from "@/features/institutions/api";
import { useSyncSessions } from "@/features/syncs/api";
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

function getDeviceInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "DV";
}

function DeviceAvatar({
  device,
  className,
}: {
  device: Pick<DeviceRecord, "name" | "assignmentScope">;
  className?: string;
}) {
  const Icon = device.assignmentScope === "home" ? Home : Smartphone;

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-primary", className)}>
      <div className="flex flex-col items-center justify-center leading-none">
        <Icon className="size-4" />
        <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-primary/80">{getDeviceInitials(device.name)}</span>
      </div>
    </div>
  );
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
  selectedDevice: DeviceRecord & { relatedSyncCount: number };
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
          <div className="flex min-w-0 items-center gap-3">
            <DeviceAvatar device={selectedDevice} className="size-14" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{selectedDevice.name}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{selectedDevice.deviceId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {scopeBadge(selectedDevice)}
            <Badge variant={selectedDevice.status ? "secondary" : "outline"}>{statusLabel(selectedDevice.status)}</Badge>
            <Badge variant={selectedDevice.relatedSyncCount > 0 ? "secondary" : "outline"}>
              {selectedDevice.relatedSyncCount > 0 ? "con sync visible" : "sin sync visible"}
            </Badge>
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

type DeviceFocusFilter = "all" | "review" | "no_owner" | "no_status" | "no_metadata" | "online" | "with_activity" | "without_sync";

export function DevicesTable() {
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "home" | "institution">("all");
  const [focusFilter, setFocusFilter] = useState<DeviceFocusFilter>("all");
  const [accessFilter, setAccessFilter] = useState<"all" | "owned" | "institution" | "shared" | "unresolved">("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const linkedOwnerUserId = searchParams.get("ownerUserId")?.trim() || "";
  const linkedOwnerUserName = searchParams.get("ownerUserName")?.trim() || "";

  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data]);

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
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const deviceRows = useMemo(() => {
    return devices.map((device) => {
      const relatedSyncs = syncs.filter(
        (sync) => sync.bleDeviceId === device.id || (sync.deviceId && sync.deviceId === device.deviceId),
      );
      const relatedGames = games.filter((game) => game.bleDeviceId === device.id);
      const isOwnedByCurrentUser = Boolean(
        (currentUser?.id && device.ownerUserId === currentUser.id)
        || (currentUserEmail && (device.ownerUserEmail || "").trim().toLowerCase() === currentUserEmail),
      );
      const isInstitutionVisible = Boolean(
        device.educationalCenterId
        && currentUser?.educationalCenterId
        && device.educationalCenterId === currentUser.educationalCenterId,
      );

      const accessRelation = isOwnedByCurrentUser
        ? "mis dispositivos"
        : isInstitutionVisible
          ? "institución visible"
          : device.ownerUserId || device.ownerUserEmail
            ? "compartido visible"
            : "sin asociación resuelta";

      const lastSyncedAt = relatedSyncs
        .map((sync) => sync.syncedAt || sync.receivedAt || sync.startedAt || null)
        .filter(Boolean)
        .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;

      const hasUnresolvedAssociation = !device.ownerUserId && !device.ownerUserEmail && device.assignmentScope === "institution";
      const hasOperationalActivity = relatedSyncs.length > 0 || relatedGames.length > 0;
      const reviewReasons = [
        !device.ownerUserId && !device.ownerUserEmail ? "sin responsable claro" : null,
        !device.status ? "sin status operativo" : null,
        Object.keys(device.deviceMetadata || {}).length === 0 ? "sin metadata visible" : null,
        relatedSyncs.length === 0 ? "sin sync visible" : null,
      ].filter((value): value is string => Boolean(value));

      return {
        ...device,
        accessRelation,
        isOwnedByCurrentUser,
        isInstitutionVisible,
        hasUnresolvedAssociation,
        relatedSyncCount: relatedSyncs.length,
        relatedGameCount: relatedGames.length,
        lastSyncedAt,
        hasOperationalActivity,
        reviewReasons,
        isReadyForClassroom: Boolean(
          device.status &&
          !hasUnresolvedAssociation &&
          hasOperationalActivity,
        ),
      };
    });
  }, [currentUser, currentUserEmail, devices, games, syncs]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveInstitutionFilter = institutionFilter === "all" && scopedInstitutionId ? scopedInstitutionId : institutionFilter;

    return deviceRows.filter((device) => {
      if (linkedOwnerUserId && device.ownerUserId !== linkedOwnerUserId) return false;
      if (scopeFilter !== "all" && device.assignmentScope !== scopeFilter) return false;
      if (
        effectiveInstitutionFilter !== "all" &&
        (device.assignmentScope !== "institution" || device.educationalCenterId !== effectiveInstitutionFilter)
      ) {
        return false;
      }
      if (accessFilter === "owned" && !device.isOwnedByCurrentUser) return false;
      if (accessFilter === "institution" && !device.isInstitutionVisible) return false;
      if (accessFilter === "shared" && device.accessRelation !== "compartido visible") return false;
      if (accessFilter === "unresolved" && !device.hasUnresolvedAssociation) return false;
      const matchesFocus = (() => {
        switch (focusFilter) {
          case "review":
            return !device.ownerUserId || !device.status || Object.keys(device.deviceMetadata || {}).length === 0;
          case "no_owner":
            return !device.ownerUserId;
          case "no_status":
            return !device.status;
          case "no_metadata":
            return Object.keys(device.deviceMetadata || {}).length === 0;
          case "online":
            return (device.status || "").toLowerCase().includes("online") || (device.status || "").toLowerCase().includes("active");
          case "with_activity":
            return device.hasOperationalActivity;
          case "without_sync":
            return device.relatedSyncCount === 0;
          default:
            return true;
        }
      })();
      if (!matchesFocus) return false;
      if (!normalized) return true;

      return [
        device.deviceId,
        device.name,
        device.assignmentScope === "home" ? "home" : device.educationalCenterName,
        device.ownerUserName,
        device.ownerUserEmail,
        device.firmwareVersion,
        device.status,
        device.accessRelation,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [accessFilter, deviceRows, focusFilter, institutionFilter, linkedOwnerUserId, query, scopeFilter, scopedInstitutionId]);

  const selectedDevice = useMemo(
    () => filtered.find((device) => device.id === selectedDeviceId) || deviceRows.find((device) => device.id === selectedDeviceId) || null,
    [deviceRows, filtered, selectedDeviceId],
  );

  const pagination = useListPagination(filtered);

  const metrics = useMemo(() => {
    const onlineDevices = deviceRows.filter((device) => (device.status || "").toLowerCase().includes("online") || (device.status || "").toLowerCase().includes("active")).length;
    const homeDevices = deviceRows.filter((device) => device.assignmentScope === "home").length;
    const institutionDevices = deviceRows.filter((device) => device.assignmentScope === "institution").length;
    const devicesWithOwner = deviceRows.filter((device) => Boolean(device.ownerUserId)).length;
    const devicesWithMetadata = deviceRows.filter((device) => Object.keys(device.deviceMetadata || {}).length > 0).length;
    const devicesWithoutOwner = deviceRows.filter((device) => !device.ownerUserId).length;
    const devicesWithoutStatus = deviceRows.filter((device) => !device.status).length;
    const devicesWithoutMetadata = deviceRows.filter((device) => Object.keys(device.deviceMetadata || {}).length === 0).length;
    const reviewDevices = deviceRows.filter((device) => !device.ownerUserId || !device.status || Object.keys(device.deviceMetadata || {}).length === 0).length;

    return {
      total: deviceRows.length,
      onlineDevices,
      homeDevices,
      institutionDevices,
      devicesWithOwner,
      devicesWithMetadata,
      devicesWithoutOwner,
      devicesWithoutStatus,
      devicesWithoutMetadata,
      reviewDevices,
      ownedDevices: deviceRows.filter((device) => device.isOwnedByCurrentUser).length,
      institutionVisibleDevices: deviceRows.filter((device) => device.isInstitutionVisible).length,
      sharedDevices: deviceRows.filter((device) => device.accessRelation === "compartido visible").length,
      unresolvedDevices: deviceRows.filter((device) => device.hasUnresolvedAssociation).length,
      devicesWithActivity: deviceRows.filter((device) => device.hasOperationalActivity).length,
      devicesWithoutSync: deviceRows.filter((device) => device.relatedSyncCount === 0).length,
    };
  }, [deviceRows]);

  const focusSegments = [
    { key: "all" as const, label: "Todos", count: metrics.total },
    { key: "review" as const, label: "Conviene revisar", count: metrics.reviewDevices },
    { key: "no_owner" as const, label: "Sin responsable", count: metrics.devicesWithoutOwner },
    { key: "no_status" as const, label: "Sin status", count: metrics.devicesWithoutStatus },
    { key: "no_metadata" as const, label: "Sin metadata", count: metrics.devicesWithoutMetadata },
    { key: "online" as const, label: "Online", count: metrics.onlineDevices },
    { key: "with_activity" as const, label: "Con actividad", count: metrics.devicesWithActivity },
    { key: "without_sync" as const, label: "Sin sync visible", count: metrics.devicesWithoutSync },
  ];

  const accessSegments = [
    { key: "all" as const, label: "Todos", count: metrics.total },
    { key: "owned" as const, label: "Mis dispositivos", count: metrics.ownedDevices },
    { key: "institution" as const, label: "Institución visible", count: metrics.institutionVisibleDevices },
    { key: "shared" as const, label: "Compartidos", count: metrics.sharedDevices },
    { key: "unresolved" as const, label: "Sin asociación resuelta", count: metrics.unresolvedDevices },
  ];

  const institutionFilterDisabled = Boolean(scopedInstitutionId) || scopeFilter === "home";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isTeacherView ? "Teacher" : isDirectorView ? "Director" : isInstitutionScopedView ? "Institution admin" : "Operación"}
        title="Dispositivos"
        description={
          isTeacherView
            ? "Vista operativa de dispositivos visibles para el docente, aclarando si el hardware entra por ownership directo, alcance institucional o asociaciones compartidas."
            : isDirectorView
            ? `Vista de coordinación del parque para ${scopedInstitutionName || "la institución"}, priorizando readiness, ownership y señales de seguimiento.`
            : isInstitutionScopedView
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
            <select
              value={accessFilter}
              onChange={(event) => setAccessFilter(event.target.value as "all" | "owned" | "institution" | "shared" | "unresolved")}
              className="h-10 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos los accesos</option>
              <option value="owned">Mis dispositivos</option>
              <option value="institution">Institución visible</option>
              <option value="shared">Compartidos</option>
              <option value="unresolved">Sin asociación resuelta</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setScopeFilter("all");
                setInstitutionFilter(scopedInstitutionId || "all");
                setFocusFilter("all");
                setAccessFilter("all");
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Limpiar filtros
            </button>
            {linkedOwnerUserId ? (
              <button
                type="button"
                onClick={() => router.push(pathname)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-4 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                Quitar filtro de usuario
              </button>
            ) : null}
          </div>
        }
      />

      {(scopedInstitutionName || linkedOwnerUserId) ? (
        <div className="flex flex-wrap gap-2">
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
          {linkedOwnerUserId ? <Badge variant="outline">Usuario filtrado: {linkedOwnerUserName || linkedOwnerUserId}</Badge> : null}
        </div>
      ) : null}

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Acceso visible</p>
              <p className="text-sm text-muted-foreground">Filtrá por relación de acceso para entender por qué aparece cada dispositivo.</p>
            </div>
            <Badge variant="outline">{filtered.length} visibles</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
          {accessSegments.map((segment) => (
            <button
              key={segment.key}
              type="button"
              onClick={() => setAccessFilter(segment.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                accessFilter === segment.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              <span>{segment.label}</span>
              <Badge variant={accessFilter === segment.key ? "secondary" : "outline"} className={accessFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </button>
          ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {devicesQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            {isDirectorView ? (
              <>
                <SummaryCard label="Dispositivos" value={String(metrics.total)} hint="Parque visible para coordinación institucional." icon={Smartphone} />
                <SummaryCard label="Institución" value={String(metrics.institutionDevices)} hint="Asignados al centro que dirigís." icon={University} />
                <SummaryCard label="Online" value={String(metrics.onlineDevices)} hint="Lectura rápida del parque activo." icon={Wifi} />
                <SummaryCard label="Con actividad" value={String(metrics.devicesWithActivity)} hint="Tuvieron syncs o partidas visibles." icon={ShieldCheck} />
                <SummaryCard label="Sin sync visible" value={String(metrics.devicesWithoutSync)} hint="Conviene chequear conectividad o uso reciente." icon={Wifi} />
                <SummaryCard label="Sin responsable" value={String(metrics.devicesWithoutOwner)} hint="Ownership pendiente o incompleto." icon={UserRound} />
                <SummaryCard label="Conviene revisar" value={String(metrics.reviewDevices)} hint="Tienen alguna señal blanda para seguimiento." icon={Home} />
              </>
            ) : (
              <>
                <SummaryCard label="Dispositivos" value={String(metrics.total)} hint="Inventario visible según ACL real." icon={Smartphone} />
                <SummaryCard label="Home" value={String(metrics.homeDevices)} hint="Sin centro educativo asociado, por diseño." icon={Home} />
                <SummaryCard label="Institución" value={String(metrics.institutionDevices)} hint="Asignados a una institución concreta." icon={University} />
                <SummaryCard label="Online" value={String(metrics.onlineDevices)} hint="Lectura rápida del parque activo." icon={Wifi} />
                <SummaryCard label="Sin sync visible" value={String(metrics.devicesWithoutSync)} hint="Sirve para detectar equipos apagados o poco usados." icon={Wifi} />
                <SummaryCard label="Con responsable" value={String(metrics.devicesWithOwner)} hint="Ownership ya resuelto desde backend." icon={UserRound} />
                <SummaryCard label="Con metadata" value={String(metrics.devicesWithMetadata)} hint="Ayuda a soporte y QA manual." icon={ShieldCheck} />
              </>
            )}
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Enfocar revisión</p>
              <p className="text-sm text-muted-foreground">Recortá el parque por señales blandas antes de abrir el detalle.</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setFocusFilter("all")}>
              Limpiar foco
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
          {focusSegments.map((segment) => (
            <button
              key={segment.key}
              type="button"
              onClick={() => setFocusFilter(segment.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                focusFilter === segment.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              <span>{segment.label}</span>
              <Badge variant={focusFilter === segment.key ? "secondary" : "outline"} className={focusFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </button>
          ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Parque de dispositivos</CardTitle>
                <CardDescription>
                  {isTeacherView
                    ? "Seleccioná un dispositivo para entender por qué lo ves, si tuvo actividad reciente y qué conviene revisar antes de usarlo en aula."
                    : isDirectorView
                    ? "Seleccioná un dispositivo para revisar ownership, actividad y señales de seguimiento antes de coordinar con soporte o con el equipo docente."
                    : "Seleccioná un dispositivo para revisar y editar su alcance, ownership y estado operativo."}
                </CardDescription>
              </div>
              <ListPaginationControls
                pageSize={pagination.pageSize}
                setPageSize={pagination.setPageSize}
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                paginationStart={pagination.paginationStart}
                paginationEnd={pagination.paginationEnd}
                goToPreviousPage={pagination.goToPreviousPage}
                goToNextPage={pagination.goToNextPage}
              />
            </div>
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
                    <TableHead>Acceso</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No hay dispositivos para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagination.paginatedItems.map((device) => (
                      <TableRow
                        key={device.id}
                        className={cn("cursor-pointer", selectedDeviceId === device.id && "border-primary/30 bg-primary/8")}
                        onClick={() => setSelectedDeviceId(device.id)}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <DeviceAvatar device={device} className="size-10" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{device.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{device.assignmentScope === "home" ? "Home" : device.educationalCenterName || "Institución"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                        <TableCell>{scopeBadge(device)}</TableCell>
                        <TableCell>{locationLabel(device)}</TableCell>
                        <TableCell>{device.ownerUserName || device.ownerUserEmail || "sin responsable"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={device.hasUnresolvedAssociation ? "warning" : "outline"}>{device.accessRelation}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {device.relatedSyncCount} syncs, {device.relatedGameCount} partidas
                            </span>
                          </div>
                        </TableCell>
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
            <CardTitle>{isTeacherView ? "Detalle operativo para aula" : isDirectorView ? "Detalle de coordinación" : "Detalle y edición"}</CardTitle>
            <CardDescription>
              {isTeacherView
                ? "Para docente, este panel deja explícitos ownership, actividad visible y señales de revisión. Si la sesión no puede editar, la lectura sigue siendo útil para decidir rápido qué dispositivo conviene usar o escalar."
                : isDirectorView
                ? "Para dirección, este panel deja explícitas las señales blandas de seguimiento y si el dispositivo parece estable o necesita coordinación."
                : <>Este panel usa mutaciones reales sobre <code>/ble-device/&lt;id&gt;</code> para persistir cambios operativos mínimos sin inventar un flujo paralelo.</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedDevice ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí un dispositivo para revisar y editar su contexto operativo.
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <DeviceAvatar device={selectedDevice} className="size-14" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedDevice.name}</p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{selectedDevice.deviceId}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={selectedDevice.hasUnresolvedAssociation ? "warning" : "outline"}>{selectedDevice.accessRelation}</Badge>
                      {selectedDevice.hasOperationalActivity ? <Badge variant="secondary">actividad visible</Badge> : <Badge variant="outline">sin actividad visible</Badge>}
                      <Badge variant={selectedDevice.relatedSyncCount > 0 ? "secondary" : "outline"}>
                        {selectedDevice.relatedSyncCount > 0 ? "con sync visible" : "sin sync visible"}
                      </Badge>
                      {isTeacherView ? (
                        <Badge variant={selectedDevice.isReadyForClassroom ? "secondary" : "warning"}>
                          {selectedDevice.isReadyForClassroom ? "listo para aula" : "conviene revisar"}
                        </Badge>
                      ) : null}
                      {isDirectorView ? (
                        <Badge variant={selectedDevice.reviewReasons.length === 0 ? "secondary" : "warning"}>
                          {selectedDevice.reviewReasons.length === 0 ? "estable para coordinar" : "requiere seguimiento"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Syncs visibles: {selectedDevice.relatedSyncCount}</p>
                    <p>Partidas visibles: {selectedDevice.relatedGameCount}</p>
                    <p>Última sync visible: {formatDateTime(selectedDevice.lastSyncedAt)}</p>
                    <p>Contexto: {selectedDevice.isOwnedByCurrentUser ? "owner directo" : selectedDevice.isInstitutionVisible ? "scope institucional" : selectedDevice.hasUnresolvedAssociation ? "falta asociación" : "visible por ACL compartida"}</p>
                  </div>
                  {isTeacherView || isDirectorView ? (
                    <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{isTeacherView ? "Qué mirar primero" : "Señales de coordinación"}</p>
                      {selectedDevice.reviewReasons.length ? (
                        <ul className="mt-2 space-y-1">
                          {selectedDevice.reviewReasons.map((reason) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2">
                          {isTeacherView
                            ? "No aparece ninguna señal blanda fuerte. Si además respondió en la última sync visible, debería estar listo para la jornada."
                            : "No aparecen señales blandas fuertes. Desde dirección, este dispositivo se ve estable para seguimiento normal sin escalamiento inmediato."}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
