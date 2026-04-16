"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Globe, Mail, MapPin, Phone, Search, ShieldCheck, Smartphone, Trash2, UserPlus, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import {
  createInstitution,
  deleteInstitution,
  updateInstitution,
  useInstitutionById,
  useInstitutions,
} from "@/features/institutions/api";
import type {
  CreateInstitutionPayload,
  InstitutionMutationPayload,
  InstitutionRecord,
  UpdateInstitutionPayload,
} from "@/features/institutions/types";
import { useUsers } from "@/features/users/api";
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

type FormMode = "create" | "edit";
type FeedbackState = { type: "success" | "error"; message: string } | null;

type InstitutionFormState = {
  name: string;
  email: string;
  phoneNumber: string;
  url: string;
  addressFirstLine: string;
  addressSecondLine: string;
  countryCode: string;
  city: string;
  state: string;
  postalCode: string;
};

type InstitutionRow = InstitutionRecord & {
  userCount: number;
  deviceCount: number;
  classGroupCount: number;
  studentCount: number;
  linkedUserNames: string[];
  linkedDeviceNames: string[];
  needsReview: boolean;
};

function emptyFormState(): InstitutionFormState {
  return {
    name: "",
    email: "",
    phoneNumber: "",
    url: "",
    addressFirstLine: "",
    addressSecondLine: "",
    countryCode: "",
    city: "",
    state: "",
    postalCode: "",
  };
}

function formFromInstitution(institution: InstitutionRecord): InstitutionFormState {
  return {
    name: institution.name,
    email: institution.email,
    phoneNumber: institution.phoneNumber,
    url: institution.url || "",
    addressFirstLine: institution.address?.addressFirstLine || "",
    addressSecondLine: institution.address?.addressSecondLine || "",
    countryCode: institution.address?.countryCode || "",
    city: institution.address?.city || "",
    state: institution.address?.state || "",
    postalCode: institution.address?.postalCode || "",
  };
}

function buildPayload(form: InstitutionFormState) {
  if (!form.name.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
    return { error: "Completá nombre, email y teléfono." };
  }

  if (!form.addressFirstLine.trim() || !form.city.trim() || !form.countryCode.trim()) {
    return { error: "Completá al menos calle, ciudad y país." };
  }

  const payload: InstitutionMutationPayload = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: form.phoneNumber.trim(),
    url: form.url.trim() || null,
    address: {
      addressFirstLine: form.addressFirstLine.trim(),
      addressSecondLine: form.addressSecondLine.trim() || null,
      countryCode: form.countryCode.trim().toUpperCase(),
      city: form.city.trim(),
      state: form.state.trim() || null,
      postalCode: form.postalCode.trim() || null,
    },
  };

  return { payload };
}

export function InstitutionsOverview() {
  const { tokens, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FormMode>("edit");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [form, setForm] = useState<InstitutionFormState>(emptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const institutionDetailQuery = useInstitutionById(tokens?.accessToken, selectedInstitutionId);
  const usersQuery = useUsers(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);

  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data ?? [], [devicesQuery.data?.data]);

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

  const canCreateInstitutions = hasAnyPermission("educational_center:create", "educational-center:create");
  const canUpdateInstitutions = hasAnyPermission("educational_center:update", "educational-center:update");
  const canDeleteInstitutions = hasAnyPermission("educational_center:delete", "educational-center:delete");
  const canSubmitForm = mode === "create" ? canCreateInstitutions : canUpdateInstitutions;

  const createInstitutionMutation = useMutation({
    mutationFn: (payload: CreateInstitutionPayload) => createInstitution(tokens?.accessToken as string, payload),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      setMode("edit");
      setSelectedInstitutionId(created.id);
      setForm(formFromInstitution(created));
      setFeedback({ type: "success", message: `Institución ${created.name} creada.` });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const updateInstitutionMutation = useMutation({
    mutationFn: ({ institutionId, payload }: { institutionId: string; payload: UpdateInstitutionPayload }) =>
      updateInstitution(tokens?.accessToken as string, institutionId, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      setSelectedInstitutionId(updated.id);
      setForm(formFromInstitution(updated));
      setFeedback({ type: "success", message: `Institución ${updated.name} actualizada.` });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const deleteInstitutionMutation = useMutation({
    mutationFn: (institutionId: string) => deleteInstitution(tokens?.accessToken as string, institutionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      setMode("edit");
      setSelectedInstitutionId(null);
      setForm(emptyFormState());
      setFeedback({ type: "success", message: "Institución eliminada." });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const usersByInstitutionId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of users) {
      if (!item.educationalCenterId) continue;
      const current = map.get(item.educationalCenterId) || [];
      current.push(item.fullName);
      map.set(item.educationalCenterId, current);
    }
    return map;
  }, [users]);

  const devicesByInstitutionId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of devices) {
      if (!item.educationalCenterId) continue;
      const current = map.get(item.educationalCenterId) || [];
      current.push(item.name || item.deviceId);
      map.set(item.educationalCenterId, current);
    }
    return map;
  }, [devices]);

  const institutionRows = useMemo<InstitutionRow[]>(() => {
    return institutions.map((institution) => {
      const linkedUserNames = usersByInstitutionId.get(institution.id) || [];
      const linkedDeviceNames = devicesByInstitutionId.get(institution.id) || [];
      const userCount = institution.operationalSummary?.userCount ?? linkedUserNames.length;
      const deviceCount = institution.operationalSummary?.deviceCount ?? linkedDeviceNames.length;
      const classGroupCount = institution.operationalSummary?.classGroupCount ?? 0;
      const studentCount = institution.operationalSummary?.studentCount ?? 0;
      const needsReview = institution.operationalSummary?.needsReview ?? (!institution.url || !institution.phoneNumber || !institution.address?.addressFirstLine);

      return {
        ...institution,
        userCount,
        deviceCount,
        classGroupCount,
        studentCount,
        linkedUserNames,
        linkedDeviceNames,
        needsReview,
      };
    });
  }, [devicesByInstitutionId, institutions, usersByInstitutionId]);

  const selectedInstitution = useMemo(
    () => institutionRows.find((item) => item.id === selectedInstitutionId) || null,
    [institutionRows, selectedInstitutionId],
  );
  const selectedInstitutionDetail = institutionDetailQuery.data || null;
  const previewUsers = selectedInstitutionDetail?.operationalPreview?.users || [];
  const previewDevices = selectedInstitutionDetail?.operationalPreview?.devices || [];
  const previewClassGroups = selectedInstitutionDetail?.operationalPreview?.classGroups || [];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return institutionRows;

    return institutionRows.filter((item) =>
      [
        item.name,
        item.email,
        item.phoneNumber,
        item.city,
        item.country,
        item.url,
        ...item.linkedUserNames,
        ...item.linkedDeviceNames,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [institutionRows, query]);

  const metrics = useMemo(() => {
    return {
      totalInstitutions: institutionRows.length,
      totalUsersLinked: institutionRows.reduce((acc, item) => acc + item.userCount, 0),
      totalDevicesLinked: institutionRows.reduce((acc, item) => acc + item.deviceCount, 0),
      totalClassesLinked: institutionRows.reduce((acc, item) => acc + item.classGroupCount, 0),
      totalStudentsLinked: institutionRows.reduce((acc, item) => acc + item.studentCount, 0),
      reviewInstitutions: institutionRows.filter((item) => item.needsReview).length,
    };
  }, [institutionRows]);

  const isSaving =
    createInstitutionMutation.isPending || updateInstitutionMutation.isPending || deleteInstitutionMutation.isPending;

  function updateFormField<K extends keyof InstitutionFormState>(key: K, value: InstitutionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectInstitution(institution: InstitutionRow) {
    setMode("edit");
    setSelectedInstitutionId(institution.id);
    setForm(formFromInstitution(institution));
    setFeedback(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!canSubmitForm) {
      setFeedback({
        type: "error",
        message: mode === "create" ? "Tu acceso actual no permite crear instituciones." : "Tu acceso actual no permite editar instituciones.",
      });
      return;
    }

    const result = buildPayload(form);
    if (!result.payload) {
      setFeedback({ type: "error", message: result.error || "No se pudo preparar el payload." });
      return;
    }

    if (mode === "create") {
      await createInstitutionMutation.mutateAsync(result.payload as CreateInstitutionPayload);
      return;
    }

    if (!selectedInstitutionId) {
      setFeedback({ type: "error", message: "Seleccioná una institución para editar." });
      return;
    }

    await updateInstitutionMutation.mutateAsync({
      institutionId: selectedInstitutionId,
      payload: result.payload as UpdateInstitutionPayload,
    });
  }

  async function handleDelete() {
    if (!selectedInstitutionId || !selectedInstitution) return;
    if (!canDeleteInstitutions) {
      setFeedback({ type: "error", message: "Tu acceso actual no permite eliminar instituciones." });
      return;
    }
    if (!globalThis.confirm(`¿Eliminar ${selectedInstitution.name}?`)) return;
    setFeedback(null);
    await deleteInstitutionMutation.mutateAsync(selectedInstitutionId);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? "Institution admin" : "Superadmin"}
        title="Instituciones"
        description={
          isInstitutionScopedView
            ? `Vista operativa sobre ${scopedInstitutionName}. Ya cruza instituciones con usuarios y dispositivos reales.`
            : "La vista ahora conecta instituciones reales del backend con impacto operativo en usuarios y dispositivos."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por institución, email, usuario o dispositivo"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              disabled={!canCreateInstitutions}
              onClick={() => {
                setMode("create");
                setSelectedInstitutionId(null);
                setForm(emptyFormState());
                setFeedback(null);
              }}
            >
              <UserPlus className="size-4" />
              {canCreateInstitutions ? "Nueva institución" : "Alta no disponible"}
            </Button>
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
              {isInstitutionScopedView && scopedInstitutionName
                ? `Estás operando sobre ${scopedInstitutionName}. La vista ya refleja el perímetro real expuesto por el backend.`
                : "Cada institución se muestra como unidad operativa con usuarios, dispositivos y datos de contacto conectados al backend real."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={canCreateInstitutions ? "secondary" : "outline"}>{canCreateInstitutions ? "alta habilitada" : "sin alta"}</Badge>
              <Badge variant={canUpdateInstitutions ? "secondary" : "outline"}>{canUpdateInstitutions ? "edición habilitada" : "solo lectura"}</Badge>
              <Badge variant={canDeleteInstitutions ? "secondary" : "outline"}>{canDeleteInstitutions ? "baja habilitada" : "sin baja"}</Badge>
            </div>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {institutionsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Instituciones visibles"
              value={String(metrics.totalInstitutions)}
              hint="Listado real sobre /educational-center con scope backend aplicado."
              icon={Building2}
            />
            <SummaryCard
              label="Usuarios vinculados"
              value={String(metrics.totalUsersLinked)}
              hint="Cruce útil para saber qué instituciones tienen operación humana activa."
              icon={Users}
            />
            <SummaryCard
              label="Dispositivos vinculados"
              value={String(metrics.totalDevicesLinked)}
              hint="Ayuda a leer despliegue físico y cobertura operativa por cliente."
              icon={Smartphone}
            />
            <SummaryCard
              label="Grupos vinculados"
              value={String(metrics.totalClassesLinked)}
              hint="Ahora sale del backend compartido, útil para leer profundidad pedagógica por institución."
              icon={Building2}
            />
            <SummaryCard
              label="Estudiantes vinculados"
              value={String(metrics.totalStudentsLinked)}
              hint="También viene consolidado desde el backend para no depender solo del dashboard."
              icon={Users}
            />
            <SummaryCard
              label="Necesitan revisión"
              value={String(metrics.reviewInstitutions)}
              hint="Falta URL, teléfono o dirección básica para operar con comodidad."
              icon={ShieldCheck}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Mapa institucional</CardTitle>
            <CardDescription>
              Seleccioná una institución para revisar sus datos base, su estado operativo y los vínculos con usuarios y dispositivos.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {institutionsQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : institutionsQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(institutionsQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institución</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No hay instituciones para mostrar con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const active = mode === "edit" && selectedInstitutionId === item.id;
                      return (
                        <TableRow key={item.id} className={cn("cursor-pointer", active && "bg-primary/5")} onClick={() => selectInstitution(item)}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{item.phoneNumber || "-"}</p>
                              <p className="text-xs text-muted-foreground">{item.city || item.country || "Sin ubicación"}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.userCount}</TableCell>
                          <TableCell>{item.deviceCount}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={item.status === "active" ? "success" : "outline"}>
                                {item.status === "active" ? "activa" : "eliminada"}
                              </Badge>
                              {item.needsReview ? <Badge variant="outline">revisar</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>{formatDateTime(item.updatedAt || item.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>{mode === "create" ? "Alta de institución" : "Editar institución"}</CardTitle>
              <CardDescription>
                {mode === "create"
                  ? canCreateInstitutions
                    ? "Alta conectada al endpoint real de instituciones."
                    : "Tu perfil actual no expone alta de instituciones."
                  : canUpdateInstitutions
                    ? "Datos base del cliente, contacto y localización operativa."
                    : "Vista de solo lectura para los datos base de la institución."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {feedback ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm",
                    feedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-destructive/20 bg-destructive/5 text-destructive",
                  )}
                >
                  {feedback.message}
                </div>
              ) : null}

              {mode === "edit" && !selectedInstitution ? (
                <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                  Elegí una institución de la tabla para editarla o crear una nueva.
                </div>
              ) : (
                <>
                  {mode === "edit" && selectedInstitution ? (
                    <div className="rounded-2xl bg-background/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{selectedInstitution.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{selectedInstitution.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={selectedInstitution.status === "active" ? "success" : "outline"}>
                            {selectedInstitution.status === "active" ? "activa" : "eliminada"}
                          </Badge>
                          {selectedInstitution.needsReview ? <Badge variant="outline">revisar</Badge> : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>Usuarios vinculados: {selectedInstitution.userCount}</p>
                        <p>Dispositivos vinculados: {selectedInstitution.deviceCount}</p>
                        <p>Grupos vinculados: {selectedInstitution.classGroupCount}</p>
                        <p>Estudiantes vinculados: {selectedInstitution.studentCount}</p>
                        <p>Creada: {formatDateTime(selectedInstitution.createdAt)}</p>
                        <p>Actualizada: {formatDateTime(selectedInstitution.updatedAt)}</p>
                      </div>
                    </div>
                  ) : null}

                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input id="name" disabled={!canSubmitForm} value={form.name} onChange={(event) => updateFormField("name", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" disabled={!canSubmitForm} type="email" value={form.email} onChange={(event) => updateFormField("email", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Teléfono</Label>
                        <Input id="phoneNumber" disabled={!canSubmitForm} value={form.phoneNumber} onChange={(event) => updateFormField("phoneNumber", event.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="url">URL</Label>
                        <Input id="url" disabled={!canSubmitForm} value={form.url} onChange={(event) => updateFormField("url", event.target.value)} placeholder="https://..." />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl bg-background/70 p-4">
                      <p className="text-sm font-medium text-foreground">Dirección</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="addressFirstLine">Calle</Label>
                          <Input id="addressFirstLine" disabled={!canSubmitForm} value={form.addressFirstLine} onChange={(event) => updateFormField("addressFirstLine", event.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="addressSecondLine">Complemento</Label>
                          <Input id="addressSecondLine" disabled={!canSubmitForm} value={form.addressSecondLine} onChange={(event) => updateFormField("addressSecondLine", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">Ciudad</Label>
                          <Input id="city" disabled={!canSubmitForm} value={form.city} onChange={(event) => updateFormField("city", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="countryCode">País (código)</Label>
                          <Input id="countryCode" disabled={!canSubmitForm} value={form.countryCode} onChange={(event) => updateFormField("countryCode", event.target.value)} placeholder="UY" maxLength={2} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">Departamento / estado</Label>
                          <Input id="state" disabled={!canSubmitForm} value={form.state} onChange={(event) => updateFormField("state", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="postalCode">Código postal</Label>
                          <Input id="postalCode" disabled={!canSubmitForm} value={form.postalCode} onChange={(event) => updateFormField("postalCode", event.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button type="submit" disabled={isSaving || !tokens?.accessToken || !canSubmitForm}>
                        {mode === "create" ? (canCreateInstitutions ? "Crear institución" : "Alta bloqueada") : canUpdateInstitutions ? "Guardar cambios" : "Edición bloqueada"}
                      </Button>
                      {mode === "create" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setMode("edit");
                            if (selectedInstitution) setForm(formFromInstitution(selectedInstitution));
                            setFeedback(null);
                          }}
                        >
                          Cancelar
                        </Button>
                      ) : canDeleteInstitutions ? (
                        <Button type="button" variant="destructive" disabled={isSaving || !selectedInstitution} onClick={handleDelete}>
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      ) : (
                        <Badge variant="outline">Sin permiso para eliminar</Badge>
                      )}
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Impacto operativo</CardTitle>
              <CardDescription>
                Cruce rápido entre la institución seleccionada, las personas vinculadas y el parque de dispositivos asociado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedInstitution ? (
                <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                  Seleccioná una institución para revisar sus vínculos operativos.
                </div>
              ) : (
                <>
                  <div className="rounded-2xl bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MapPin className="size-4 text-primary" />
                      {selectedInstitution.address?.addressFirstLine || "Sin dirección cargada"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedInstitution.url ? (
                        <Badge variant="outline">
                          <Globe className="mr-1 size-3" />
                          {selectedInstitution.url}
                        </Badge>
                      ) : null}
                      {selectedInstitution.email ? (
                        <Badge variant="outline">
                          <Mail className="mr-1 size-3" />
                          {selectedInstitution.email}
                        </Badge>
                      ) : null}
                      {selectedInstitution.phoneNumber ? (
                        <Badge variant="outline">
                          <Phone className="mr-1 size-3" />
                          {selectedInstitution.phoneNumber}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Usuarios vinculados</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewUsers.length > 0 ? (
                        previewUsers.map((user) => (
                          <Badge key={user.id} variant="secondary">{user.fullName}</Badge>
                        ))
                      ) : selectedInstitution.linkedUserNames.length > 0 ? (
                        selectedInstitution.linkedUserNames.slice(0, 8).map((name) => (
                          <Badge key={name} variant="secondary">{name}</Badge>
                        ))
                      ) : (
                        <Badge variant="outline">sin usuarios vinculados</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Dispositivos vinculados</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewDevices.length > 0 ? (
                        previewDevices.map((device) => (
                          <Badge key={device.id} variant="outline">{device.name}</Badge>
                        ))
                      ) : selectedInstitution.linkedDeviceNames.length > 0 ? (
                        selectedInstitution.linkedDeviceNames.slice(0, 8).map((name) => (
                          <Badge key={name} variant="outline">{name}</Badge>
                        ))
                      ) : (
                        <Badge variant="outline">sin dispositivos vinculados</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Grupos vinculados</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewClassGroups.length > 0 ? (
                        previewClassGroups.map((classGroup) => (
                          <Badge key={classGroup.id} variant="outline">{classGroup.name}</Badge>
                        ))
                      ) : (
                        <Badge variant="outline">sin grupos vinculados</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">grupos</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{selectedInstitution.classGroupCount}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Conteo expuesto por el backend compartido.</p>
                    </div>
                    <div className="rounded-2xl bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">estudiantes</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{selectedInstitution.studentCount}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Sirve para entender el peso real de la institución.</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Instituciones que conviene revisar</CardTitle>
          <CardDescription>
            Señales rápidas para completar contacto, dirección o presencia web antes de seguir escalando operación.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {institutionsQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
          ) : institutionRows.filter((item) => item.needsReview).length === 0 ? (
            <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              No aparecen instituciones con observaciones básicas. Buen momento para avanzar a salud o syncs por cliente.
            </div>
          ) : (
            institutionRows
              .filter((item) => item.needsReview)
              .slice(0, 6)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectInstitution(item)}
                  className="rounded-2xl border border-border bg-white/80 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!item.phoneNumber ? <Badge variant="outline">sin teléfono</Badge> : null}
                    {!item.url ? <Badge variant="outline">sin URL</Badge> : null}
                    {!item.address?.addressFirstLine ? <Badge variant="outline">sin dirección</Badge> : null}
                    {item.userCount > 0 ? <Badge variant="secondary">{item.userCount} usuarios</Badge> : null}
                    {item.deviceCount > 0 ? <Badge variant="outline">{item.deviceCount} dispositivos</Badge> : null}
                  </div>
                </button>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
