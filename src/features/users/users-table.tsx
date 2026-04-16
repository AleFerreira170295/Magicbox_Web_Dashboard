"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, PencilLine, Phone, Search, Trash2, UserPlus, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useInstitutions } from "@/features/institutions/api";
import { createUser, deleteUser, updateUser, useUsers } from "@/features/users/api";
import type { CreateUserPayload, UpdateUserPayload, UserMutationPayload, UserRecord } from "@/features/users/types";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

const userTypeOptions = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "web|mobile", label: "Web + Mobile" },
] as const;

type FormMode = "create" | "edit";

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber: string;
  userType: CreateUserPayload["userType"];
  educationalCenterId: string;
  imageUrl: string;
  addressFirstLine: string;
  addressSecondLine: string;
  countryCode: string;
  city: string;
  state: string;
  postalCode: string;
};

function emptyFormState(): UserFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    userType: "web",
    educationalCenterId: "",
    imageUrl: "",
    addressFirstLine: "",
    addressSecondLine: "",
    countryCode: "",
    city: "",
    state: "",
    postalCode: "",
  };
}

function formFromUser(user: UserRecord): UserFormState {
  return {
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email,
    password: "",
    phoneNumber: user.phoneNumber || "",
    userType: user.userType === "mobile" || user.userType === "web|mobile" ? user.userType : "web",
    educationalCenterId: user.educationalCenterId || "",
    imageUrl: user.imageUrl || "",
    addressFirstLine: user.address?.addressFirstLine || "",
    addressSecondLine: user.address?.addressSecondLine || "",
    countryCode: user.address?.countryCode || "",
    city: user.address?.city || "",
    state: user.address?.state || "",
    postalCode: user.address?.postalCode || "",
  };
}

function buildPayload(form: UserFormState, mode: FormMode) {
  if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
    return { error: "Completá nombre, apellido, email y teléfono." };
  }

  if (mode === "create" && form.password.trim().length < 8) {
    return { error: "La contraseña inicial debe tener al menos 8 caracteres." };
  }

  const addressTouched = [
    form.addressFirstLine,
    form.addressSecondLine,
    form.countryCode,
    form.city,
    form.state,
    form.postalCode,
  ].some((value) => value.trim().length > 0);

  if (addressTouched && (!form.addressFirstLine.trim() || !form.city.trim() || !form.countryCode.trim())) {
    return { error: "Si cargás dirección, completá al menos calle, ciudad y país." };
  }

  const payload: UserMutationPayload = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: form.phoneNumber.trim(),
    userType: form.userType,
    educationalCenterId: form.educationalCenterId.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    address: addressTouched
      ? {
          addressFirstLine: form.addressFirstLine.trim(),
          addressSecondLine: form.addressSecondLine.trim() || null,
          countryCode: form.countryCode.trim().toUpperCase(),
          city: form.city.trim(),
          state: form.state.trim() || null,
          postalCode: form.postalCode.trim() || null,
        }
      : null,
  };

  if (mode === "create") {
    return {
      payload: {
        ...payload,
        password: form.password,
      } as CreateUserPayload,
    };
  }

  return { payload: payload as UpdateUserPayload };
}

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

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </select>
  );
}

export function UsersTable() {
  const { tokens } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FormMode>("edit");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const allUsers = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data?.data]);

  const institutionsById = useMemo(() => {
    const institutions = institutionsQuery.data?.data || [];
    return new Map(institutions.map((institution) => [institution.id, institution.name]));
  }, [institutionsQuery.data?.data]);

  const selectedUser = useMemo(
    () => allUsers.find((item) => item.id === selectedUserId) || null,
    [allUsers, selectedUserId],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allUsers;

    return allUsers.filter((item) =>
      [
        item.fullName,
        item.email,
        item.phoneNumber,
        item.userType,
        item.educationalCenterId,
        institutionsById.get(item.educationalCenterId || ""),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [allUsers, institutionsById, query]);

  const metrics = useMemo(() => {
    const linkedInstitution = allUsers.filter((item) => item.educationalCenterId).length;
    const dualAccess = allUsers.filter((item) => item.userType === "web|mobile").length;
    const withoutAddress = allUsers.filter((item) => !item.address).length;

    return {
      totalUsers: usersQuery.data?.total || allUsers.length,
      linkedInstitution,
      dualAccess,
      withoutAddress,
      needingReview: allUsers.filter(
        (item) => !item.educationalCenterId || !item.phoneNumber || !item.address,
      ),
    };
  }, [allUsers, usersQuery.data?.total]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(tokens?.accessToken as string, payload),
    onSuccess: async (createdUser) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setFeedback({ type: "success", message: "Usuario creado correctamente." });
      setMode("edit");
      setSelectedUserId(createdUser.id);
      setForm(formFromUser(createdUser));
    },
    onError: (error) => {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      updateUser(tokens?.accessToken as string, userId, payload),
    onSuccess: async (updatedUser) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setFeedback({ type: "success", message: "Usuario actualizado correctamente." });
      setSelectedUserId(updatedUser.id);
      setForm(formFromUser(updatedUser));
    },
    onError: (error) => {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(tokens?.accessToken as string, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setFeedback({ type: "success", message: "Usuario eliminado correctamente." });
      setSelectedUserId(null);
      setMode("create");
      setForm(emptyFormState());
    },
    onError: (error) => {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function updateFormField<K extends keyof UserFormState>(field: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resolveInstitutionLabel(userRecord: UserRecord) {
    if (!userRecord.educationalCenterId) return "Sin institución";
    return institutionsById.get(userRecord.educationalCenterId) || userRecord.educationalCenterId;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const result = buildPayload(form, mode);
    if (!result.payload) {
      setFeedback({ type: "error", message: result.error || "No se pudo preparar el payload." });
      return;
    }

    if (mode === "create") {
      await createMutation.mutateAsync(result.payload as CreateUserPayload);
      return;
    }

    if (!selectedUserId) {
      setFeedback({ type: "error", message: "Seleccioná un usuario para editar." });
      return;
    }

    await updateMutation.mutateAsync({
      userId: selectedUserId,
      payload: result.payload as UpdateUserPayload,
    });
  }

  async function handleDelete() {
    if (!selectedUser) return;
    if (!globalThis.confirm(`¿Eliminar a ${selectedUser.fullName}?`)) return;
    setFeedback(null);
    await deleteMutation.mutateAsync(selectedUser.id);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Usuarios"
        description="Ya no queda solo como una tabla. Esta vista pasa a ser un módulo operativo real para alta, edición, revisión de datos base y limpieza del padrón de usuarios." 
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, email, teléfono o institución"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                setMode("create");
                setForm(emptyFormState());
                setFeedback(null);
              }}
            >
              <UserPlus className="size-4" />
              Nuevo usuario
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {usersQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Usuarios cargados"
              value={String(metrics.totalUsers)}
              hint="Ya sale del estado placeholder y consume el endpoint real del backend." 
              icon={Users}
            />
            <SummaryCard
              label="Con institución"
              value={String(metrics.linkedInstitution)}
              hint="Sirve para medir qué tan completo está el mapa institucional." 
              icon={Building2}
            />
            <SummaryCard
              label="Web + mobile"
              value={String(metrics.dualAccess)}
              hint="Perfiles que hoy pueden convivir entre experiencia web y móvil." 
              icon={PencilLine}
            />
            <SummaryCard
              label="Sin dirección"
              value={String(metrics.withoutAddress)}
              hint="Buena señal para detectar perfiles creados rápido que conviene completar." 
              icon={Phone}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Padrón de usuarios</CardTitle>
            <CardDescription>
              Seleccioná un usuario para editarlo. Por ahora esta pantalla trabaja sobre datos base del usuario; roles y permisos finos siguen viviendo en su módulo específico.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {usersQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : usersQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(usersQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No hay usuarios para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const active = mode === "edit" && selectedUserId === item.id;
                      return (
                        <TableRow
                          key={item.id}
                          className={cn("cursor-pointer", active && "bg-primary/5")}
                          onClick={() => {
                            setMode("edit");
                            setSelectedUserId(item.id);
                            setForm(formFromUser(item));
                            setFeedback(null);
                          }}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{item.fullName}</p>
                              <p className="text-xs text-muted-foreground">ID {item.id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{item.email}</p>
                              <p className="text-xs text-muted-foreground">{item.phoneNumber || "Sin teléfono"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.userType || "sin tipo"}</Badge>
                          </TableCell>
                          <TableCell>{resolveInstitutionLabel(item)}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === "active" ? "success" : "outline"}>
                              {item.status === "active" ? "activo" : "eliminado"}
                            </Badge>
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

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{mode === "create" ? "Alta de usuario" : "Editar usuario"}</CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Alta inicial conectada al backend real."
                : "Podés corregir datos base, tipo de acceso y vínculo institucional."}
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

            {mode === "edit" && !selectedUser ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Elegí un usuario de la tabla para empezar a editarlo, o creá uno nuevo.
              </div>
            ) : (
              <>
                {mode === "edit" && selectedUser ? (
                  <div className="rounded-2xl bg-background/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{selectedUser.fullName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                      <Badge variant="secondary">{selectedUser.userType || "sin tipo"}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Creado: {formatDateTime(selectedUser.createdAt)}</p>
                      <p>Actualizado: {formatDateTime(selectedUser.updatedAt)}</p>
                      <p>Institución: {resolveInstitutionLabel(selectedUser)}</p>
                      <p>Identity ID: {selectedUser.identityId || "-"}</p>
                    </div>
                  </div>
                ) : null}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input id="firstName" value={form.firstName} onChange={(event) => updateFormField("firstName", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input id="lastName" value={form.lastName} onChange={(event) => updateFormField("lastName", event.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(event) => updateFormField("email", event.target.value)} />
                    </div>
                    {mode === "create" ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="password">Contraseña inicial</Label>
                        <Input id="password" type="password" value={form.password} onChange={(event) => updateFormField("password", event.target.value)} />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Teléfono</Label>
                      <Input id="phoneNumber" value={form.phoneNumber} onChange={(event) => updateFormField("phoneNumber", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userType">Tipo de usuario</Label>
                      <SelectField value={form.userType} onChange={(value) => updateFormField("userType", value as UserFormState["userType"])}>
                        {userTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="educationalCenterId">Institución</Label>
                      <SelectField value={form.educationalCenterId} onChange={(value) => updateFormField("educationalCenterId", value)}>
                        <option value="">Sin institución</option>
                        {(institutionsQuery.data?.data || []).map((institution) => (
                          <option key={institution.id} value={institution.id}>
                            {institution.name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="imageUrl">URL de imagen</Label>
                      <Input id="imageUrl" value={form.imageUrl} onChange={(event) => updateFormField("imageUrl", event.target.value)} placeholder="https://..." />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-background/70 p-4">
                    <p className="text-sm font-medium text-foreground">Dirección</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="addressFirstLine">Calle</Label>
                        <Input id="addressFirstLine" value={form.addressFirstLine} onChange={(event) => updateFormField("addressFirstLine", event.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="addressSecondLine">Complemento</Label>
                        <Input id="addressSecondLine" value={form.addressSecondLine} onChange={(event) => updateFormField("addressSecondLine", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input id="city" value={form.city} onChange={(event) => updateFormField("city", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="countryCode">País (código)</Label>
                        <Input id="countryCode" value={form.countryCode} onChange={(event) => updateFormField("countryCode", event.target.value)} placeholder="UY" maxLength={2} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Departamento / estado</Label>
                        <Input id="state" value={form.state} onChange={(event) => updateFormField("state", event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Código postal</Label>
                        <Input id="postalCode" value={form.postalCode} onChange={(event) => updateFormField("postalCode", event.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={isSaving || !tokens?.accessToken}>
                      {mode === "create" ? "Crear usuario" : "Guardar cambios"}
                    </Button>
                    {mode === "create" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMode("edit");
                          if (selectedUser) {
                            setForm(formFromUser(selectedUser));
                          }
                          setFeedback(null);
                        }}
                      >
                        Cancelar
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" disabled={isSaving || !selectedUser} onClick={handleDelete}>
                        <Trash2 className="size-4" />
                        Eliminar
                      </Button>
                    )}
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Usuarios que conviene revisar</CardTitle>
          <CardDescription>
            Señales rápidas para limpieza operativa del padrón: falta de institución, teléfono o dirección.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {usersQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
          ) : metrics.needingReview.length === 0 ? (
            <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              No aparecen usuarios con señales básicas de revisión. Linda base para seguir con roles y permisos.
            </div>
          ) : (
            metrics.needingReview.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode("edit");
                  setSelectedUserId(item.id);
                  setForm(formFromUser(item));
                  setFeedback(null);
                }}
                className="rounded-2xl border border-border bg-white/80 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <p className="text-sm font-semibold text-foreground">{item.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.educationalCenterId ? <Badge variant="outline">sin institución</Badge> : null}
                  {!item.phoneNumber ? <Badge variant="outline">sin teléfono</Badge> : null}
                  {!item.address ? <Badge variant="outline">sin dirección</Badge> : null}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
