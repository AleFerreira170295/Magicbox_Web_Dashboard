"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Phone, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createPermission as createPermissionRequest,
  deletePermission as deletePermissionRequest,
  useAccessActions,
  useAccessFeatures,
  usePermissions,
} from "@/features/access-control/api";
import type { PermissionRecord } from "@/features/access-control/types";
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

const actionOrder = ["read", "create", "update", "delete"];
const GLOBAL_SCOPE = "__global__";

const roleBundles = [
  {
    role: "admin",
    label: "Admin",
    hint: "Operación global: usuarios, permisos e instituciones.",
    permissionKeys: [
      "user:read",
      "user:create",
      "user:update",
      "user:delete",
      "access_control:read",
      "access_control:create",
      "access_control:update",
      "educational_center:read",
      "educational_center:create",
      "educational_center:update",
      "ble_device:read",
      "game_data:read",
    ],
  },
  {
    role: "director",
    label: "Director",
    hint: "Lectura institucional y seguimiento operativo.",
    permissionKeys: ["user:read", "educational_center:read", "ble_device:read", "game_data:read"],
  },
  {
    role: "teacher",
    label: "Teacher",
    hint: "Seguimiento pedagógico y uso operativo básico.",
    permissionKeys: ["game_data:read", "ble_device:read"],
  },
  {
    role: "family",
    label: "Family",
    hint: "Lectura acotada orientada a experiencia familiar.",
    permissionKeys: ["game_data:read"],
  },
  {
    role: "researcher",
    label: "Researcher",
    hint: "Consulta de datos con alcance controlado.",
    permissionKeys: ["game_data:read"],
  },
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
  roles: string[];
  educationalCenterId: string;
  imageUrl: string;
  addressFirstLine: string;
  addressSecondLine: string;
  countryCode: string;
  city: string;
  state: string;
  postalCode: string;
};

type EnrichedPermission = PermissionRecord & {
  key: string;
  featureCode: string;
  featureName: string;
  actionCode: string;
  actionName: string;
};

type UserRow = UserRecord & {
  explicitPermissions: EnrichedPermission[];
  explicitPermissionKeys: string[];
  inferredRoles: string[];
  needsReview: boolean;
};

function emptyFormState(): UserFormState {
  return {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    userType: "web",
    roles: [],
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
    roles: user.roles || [],
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
    roles: Array.from(new Set(form.roles)).sort(),
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

function inferRoles(user: UserRecord, permissionKeys: string[]) {
  const roles = new Set(user.roles);
  const keySet = new Set(permissionKeys);
  const userType = (user.userType || "").toUpperCase();

  if (
    keySet.has("access_control:read") ||
    keySet.has("access_control:update") ||
    keySet.has("user:create") ||
    keySet.has("user:update") ||
    keySet.has("user:delete")
  ) {
    roles.add("admin");
  } else if (keySet.has("user:read") || keySet.has("educational_center:read")) {
    roles.add("director");
  }

  if (keySet.has("game_data:read") && userType.includes("WEB")) {
    roles.add("teacher");
  }

  if (keySet.has("game_data:read") && userType.includes("MOBILE")) {
    roles.add("family");
  }

  return Array.from(roles);
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
  const permissionsQuery = usePermissions(tokens?.accessToken);
  const actionsQuery = useAccessActions(tokens?.accessToken);
  const featuresQuery = useAccessFeatures(tokens?.accessToken);

  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [mode, setMode] = useState<FormMode>("edit");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [aclScope, setAclScope] = useState<string>(GLOBAL_SCOPE);

  const rawUsers = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const permissions = useMemo(() => permissionsQuery.data?.data ?? [], [permissionsQuery.data?.data]);
  const actions = useMemo(() => actionsQuery.data?.data ?? [], [actionsQuery.data?.data]);
  const features = useMemo(() => featuresQuery.data?.data ?? [], [featuresQuery.data?.data]);

  const institutionsById = useMemo(
    () => new Map(institutions.map((institution) => [institution.id, institution.name])),
    [institutions],
  );

  const actionsById = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions]);
  const featuresById = useMemo(() => new Map(features.map((feature) => [feature.id, feature])), [features]);
  const catalogByKey = useMemo(
    () =>
      new Map(
        features.flatMap((feature) =>
          actions.map((action) => [
            `${feature.code}:${action.code}`,
            { featureId: feature.id, actionId: action.id, featureName: feature.name, actionName: action.name },
          ]),
        ),
      ),
    [actions, features],
  );

  const enrichedPermissions = useMemo<EnrichedPermission[]>(() => {
    return permissions
      .map((permission) => {
        const feature = featuresById.get(permission.featureId);
        const action = actionsById.get(permission.actionId);
        if (!feature || !action) return null;
        return {
          ...permission,
          key: `${feature.code}:${action.code}`,
          featureCode: feature.code,
          featureName: feature.name,
          actionCode: action.code,
          actionName: action.name,
        };
      })
      .filter(Boolean) as EnrichedPermission[];
  }, [actionsById, featuresById, permissions]);

  const permissionsByUserId = useMemo(() => {
    const map = new Map<string, EnrichedPermission[]>();
    for (const permission of enrichedPermissions) {
      const current = map.get(permission.userId) || [];
      current.push(permission);
      map.set(permission.userId, current);
    }
    return map;
  }, [enrichedPermissions]);

  const users = useMemo<UserRow[]>(() => {
    return rawUsers.map((user) => {
      const explicitPermissions = permissionsByUserId.get(user.id) || [];
      const explicitPermissionKeys = Array.from(new Set(explicitPermissions.map((item) => item.key)));
      const inferredRoles = inferRoles(user, explicitPermissionKeys);
      const needsReview = !user.educationalCenterId || !user.phoneNumber || !user.address;

      return {
        ...user,
        explicitPermissions,
        explicitPermissionKeys,
        inferredRoles,
        needsReview,
      };
    });
  }, [permissionsByUserId, rawUsers]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [selectedUserId, users],
  );

  const availableRoles = useMemo(
    () => Array.from(new Set(users.flatMap((user) => user.inferredRoles))).sort(),
    [users],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((item) => {
      const matchesQuery = !normalized ||
        [
          item.fullName,
          item.email,
          item.phoneNumber,
          item.userType,
          item.educationalCenterId,
          institutionsById.get(item.educationalCenterId || ""),
          item.inferredRoles.join(", "),
          item.explicitPermissionKeys.join(", "),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));

      const matchesInstitution = !institutionFilter || item.educationalCenterId === institutionFilter;
      const matchesRole = !roleFilter || item.inferredRoles.includes(roleFilter);
      const matchesReview = !reviewOnly || item.needsReview;

      return matchesQuery && matchesInstitution && matchesRole && matchesReview;
    });
  }, [institutionFilter, institutionsById, query, reviewOnly, roleFilter, users]);

  const metrics = useMemo(() => {
    const permissionedUsers = users.filter((item) => item.explicitPermissionKeys.length > 0).length;
    const adminLikeUsers = users.filter((item) => item.inferredRoles.includes("admin")).length;
    const reviewUsers = users.filter((item) => item.needsReview).length;

    return {
      totalUsers: usersQuery.data?.total || users.length,
      permissionedUsers,
      adminLikeUsers,
      reviewUsers,
    };
  }, [users, usersQuery.data?.total]);

  const permissionsByFeature = useMemo(() => {
    if (!selectedUser) return [] as Array<{ featureId: string; featureName: string; featureCode: string; actions: typeof actions }>;

    const sortedActions = [...actions].sort((left, right) => {
      const leftIndex = actionOrder.indexOf(left.code);
      const rightIndex = actionOrder.indexOf(right.code);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex) || left.code.localeCompare(right.code);
    });

    return [...features]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((feature) => ({
        featureId: feature.id,
        featureName: feature.name,
        featureCode: feature.code,
        actions: sortedActions,
      }));
  }, [actions, features, selectedUser]);

  const createUserMutation = useMutation({
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

  const updateUserMutation = useMutation({
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

  const deleteUserMutation = useMutation({
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

  const isSaving = createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending || permissionBusy;
  const aclUnavailable = permissionsQuery.error || actionsQuery.error || featuresQuery.error;

  function updateFormField<K extends keyof UserFormState>(field: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleFormRole(role: string) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role].sort(),
    }));
  }

  async function persistUserRoles(user: UserRow, roles: string[]) {
    if (!tokens?.accessToken) return;

    await updateUserMutation.mutateAsync({
      userId: user.id,
      payload: {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        phoneNumber: user.phoneNumber || "",
        userType: user.userType === "mobile" || user.userType === "web|mobile" ? user.userType : "web",
        roles,
        educationalCenterId: user.educationalCenterId || null,
        imageUrl: user.imageUrl || null,
        address: user.address || null,
      },
    });
  }

  function resolveInstitutionLabel(user: UserRecord) {
    if (!user.educationalCenterId) return "Sin institución";
    return institutionsById.get(user.educationalCenterId) || user.educationalCenterId;
  }

  function resolveScopeLabel(educationalCenterId?: string | null) {
    if (!educationalCenterId) return "Global";
    return institutionsById.get(educationalCenterId) || educationalCenterId;
  }

  function selectUser(user: UserRow) {
    setMode("edit");
    setSelectedUserId(user.id);
    setAclScope(user.educationalCenterId || GLOBAL_SCOPE);
    setForm(formFromUser(user));
    setFeedback(null);
  }

  function hasBundle(user: UserRow, bundle: (typeof roleBundles)[number], scope: string = GLOBAL_SCOPE) {
    const scopedKeys = new Set(
      user.explicitPermissions
        .filter((item) => (scope === GLOBAL_SCOPE ? !item.educationalCenterId : item.educationalCenterId === scope))
        .map((item) => item.key),
    );
    return user.roles.includes(bundle.role) && bundle.permissionKeys.every((key) => scopedKeys.has(key));
  }

  function getPermissionEntries(user: UserRow, featureCode: string, actionCode: string, scope: string = GLOBAL_SCOPE) {
    return user.explicitPermissions.filter(
      (item) =>
        item.featureCode === featureCode &&
        item.actionCode === actionCode &&
        (scope === GLOBAL_SCOPE ? !item.educationalCenterId : item.educationalCenterId === scope),
    );
  }

  async function refreshAclQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["access-permissions"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);
  }

  async function togglePermission(user: UserRow, featureCode: string, actionCode: string, scope: string = GLOBAL_SCOPE) {
    if (!tokens?.accessToken) return;

    const permissionEntries = getPermissionEntries(user, featureCode, actionCode, scope);
    const catalogEntry = catalogByKey.get(`${featureCode}:${actionCode}`);
    if (!catalogEntry) {
      setFeedback({ type: "error", message: `No encontré el catálogo para ${featureCode}:${actionCode}.` });
      return;
    }

    setPermissionBusy(true);
    setFeedback(null);
    try {
      if (permissionEntries.length > 0) {
        for (const permission of permissionEntries) {
          await deletePermissionRequest(tokens.accessToken, permission.id);
        }
        setFeedback({ type: "success", message: `Permiso ${featureCode}:${actionCode} removido.` });
      } else {
        await createPermissionRequest(tokens.accessToken, {
          userId: user.id,
          featureId: catalogEntry.featureId,
          actionId: catalogEntry.actionId,
          educationalCenterId: scope === GLOBAL_SCOPE ? null : scope,
        });
        setFeedback({
          type: "success",
          message: `Permiso ${featureCode}:${actionCode} agregado en scope ${resolveScopeLabel(scope === GLOBAL_SCOPE ? null : scope)}.`,
        });
      }
      await refreshAclQueries();
    } catch (error) {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    } finally {
      setPermissionBusy(false);
    }
  }

  async function applyBundle(user: UserRow, bundle: (typeof roleBundles)[number], scope: string = GLOBAL_SCOPE) {
    if (!tokens?.accessToken) return;

    const missingKeys = bundle.permissionKeys.filter((key) => !user.explicitPermissionKeys.includes(key));
    const nextRoles = Array.from(new Set([...user.roles, bundle.role])).sort();
    if (missingKeys.length === 0 && user.roles.includes(bundle.role)) {
      setFeedback({ type: "success", message: `El bundle ${bundle.label} ya está completo.` });
      return;
    }

    setPermissionBusy(true);
    setFeedback(null);
    try {
      let applied = 0;
      for (const key of missingKeys) {
        const catalogEntry = catalogByKey.get(key);
        if (!catalogEntry) continue;
        await createPermissionRequest(tokens.accessToken, {
          userId: user.id,
          featureId: catalogEntry.featureId,
          actionId: catalogEntry.actionId,
          educationalCenterId: scope === GLOBAL_SCOPE ? null : scope,
        });
        applied += 1;
      }
      if (!user.roles.includes(bundle.role)) {
        await persistUserRoles(user, nextRoles);
        if (selectedUserId === user.id) {
          setForm((current) => ({ ...current, roles: nextRoles }));
        }
      }
      await refreshAclQueries();
      setFeedback({
        type: "success",
        message: `Bundle ${bundle.label} aplicado en ${resolveScopeLabel(scope === GLOBAL_SCOPE ? null : scope)}. Se agregaron ${applied} permisos base y se persistió el rol.`,
      });
    } catch (error) {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    } finally {
      setPermissionBusy(false);
    }
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
      await createUserMutation.mutateAsync(result.payload as CreateUserPayload);
      return;
    }

    if (!selectedUserId) {
      setFeedback({ type: "error", message: "Seleccioná un usuario para editar." });
      return;
    }

    await updateUserMutation.mutateAsync({
      userId: selectedUserId,
      payload: result.payload as UpdateUserPayload,
    });
  }

  async function handleDelete() {
    if (!selectedUser) return;
    if (!globalThis.confirm(`¿Eliminar a ${selectedUser.fullName}?`)) return;
    setFeedback(null);
    await deleteUserMutation.mutateAsync(selectedUser.id);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Superadmin"
        title="Usuarios"
        description="La vista ahora conecta usuarios, roles persistidos y permisos ACL explícitos desde el backend real." 
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, email, rol o permiso"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                setMode("create");
                setSelectedUserId(null);
                setAclScope(GLOBAL_SCOPE);
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
              hint="Base total del padrón sobre el endpoint real del backend." 
              icon={Users}
            />
            <SummaryCard
              label="Con permisos explícitos"
              value={String(metrics.permissionedUsers)}
              hint="Usuarios ya conectados a ACL más allá del tipo base." 
              icon={KeyRound}
            />
            <SummaryCard
              label="Perfiles admin"
              value={String(metrics.adminLikeUsers)}
              hint="Detectados por permisos globales o bundles aplicados." 
              icon={ShieldCheck}
            />
            <SummaryCard
              label="Necesitan revisión"
              value={String(metrics.reviewUsers)}
              hint="Falta de institución, teléfono o dirección." 
              icon={Phone}
            />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Institución</Label>
            <SelectField value={institutionFilter} onChange={setInstitutionFilter}>
              <option value="">Todas</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <SelectField value={roleFilter} onChange={setRoleFilter}>
              <option value="">Todos</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="space-y-2">
            <Label>Enfoque</Label>
            <SelectField value={reviewOnly ? "review" : "all"} onChange={(value) => setReviewOnly(value === "review")}>
              <option value="all">Todos</option>
              <option value="review">Solo con observaciones</option>
            </SelectField>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInstitutionFilter("");
                setRoleFilter("");
                setReviewOnly(false);
                setQuery("");
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Padrón de usuarios</CardTitle>
            <CardDescription>
              La tabla muestra roles efectivos, cantidad de permisos explícitos y señales de revisión. Seleccioná un usuario para editar sus datos y su ACL.
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
                    <TableHead>Roles</TableHead>
                    <TableHead>Permisos</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No hay usuarios para mostrar con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const active = mode === "edit" && selectedUserId === item.id;
                      return (
                        <TableRow key={item.id} className={cn("cursor-pointer", active && "bg-primary/5")} onClick={() => selectUser(item)}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{item.fullName}</p>
                              <p className="text-xs text-muted-foreground">{item.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {item.inferredRoles.length > 0 ? (
                                item.inferredRoles.map((role) => (
                                  <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline">sin rol</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.explicitPermissionKeys.length > 0 ? (
                              <span className="text-sm text-muted-foreground">{item.explicitPermissionKeys.length} explícitos</span>
                            ) : (
                              <Badge variant="outline">sin ACL explícita</Badge>
                            )}
                          </TableCell>
                          <TableCell>{resolveInstitutionLabel(item)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={item.status === "active" ? "success" : "outline"}>
                                {item.status === "active" ? "activo" : "eliminado"}
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
              <CardTitle>{mode === "create" ? "Alta de usuario" : "Editar usuario"}</CardTitle>
              <CardDescription>
                {mode === "create"
                  ? "Alta inicial conectada al backend real."
                  : "Datos base del usuario, vínculo institucional y tipo de acceso."}
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
                  Elegí un usuario de la tabla para editarlo o crear uno nuevo.
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
                        <div className="flex flex-wrap gap-2">
                          {selectedUser.inferredRoles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>Creado: {formatDateTime(selectedUser.createdAt)}</p>
                        <p>Actualizado: {formatDateTime(selectedUser.updatedAt)}</p>
                        <p>Institución: {resolveInstitutionLabel(selectedUser)}</p>
                        <p>Permisos ACL: {selectedUser.explicitPermissionKeys.length}</p>
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
                        <Label>Roles persistidos</Label>
                        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background/70 p-3">
                          {roleBundles.map((bundle) => {
                            const active = form.roles.includes(bundle.role);
                            return (
                              <Button
                                key={bundle.role}
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                onClick={() => toggleFormRole(bundle.role)}
                              >
                                {bundle.label}
                              </Button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Estos roles se guardan en backend. Los permisos finos se ajustan abajo desde ACL.
                        </p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="educationalCenterId">Institución</Label>
                        <SelectField value={form.educationalCenterId} onChange={(value) => updateFormField("educationalCenterId", value)}>
                          <option value="">Sin institución</option>
                          {institutions.map((institution) => (
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
                            if (selectedUser) setForm(formFromUser(selectedUser));
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

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Roles y permisos</CardTitle>
              <CardDescription>
                Roles persistidos para cada usuario, bundles operativos y matriz ACL para ajuste fino por feature y acción.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedUser ? (
                <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                  Seleccioná un usuario para revisar o ajustar sus permisos.
                </div>
              ) : aclUnavailable ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  No pude cargar el catálogo de ACL completo. {getErrorMessage(permissionsQuery.error || actionsQuery.error || featuresQuery.error)}
                </div>
              ) : permissionsQuery.isLoading || actionsQuery.isLoading || featuresQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-56 rounded-2xl" />
                </div>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl bg-background/70 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-end">
                      <div>
                        <p className="text-sm font-medium text-foreground">Bundles disponibles</p>
                        <p className="text-sm text-muted-foreground">
                          Aplicar un bundle agrega permisos base dentro del scope elegido.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Scope ACL</Label>
                        <SelectField value={aclScope} onChange={setAclScope}>
                          <option value={GLOBAL_SCOPE}>Global</option>
                          {institutions.map((institution) => (
                            <option key={institution.id} value={institution.id}>
                              {institution.name}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roleBundles.map((bundle) => (
                        <Button
                          key={bundle.role}
                          type="button"
                          size="sm"
                          variant={hasBundle(selectedUser, bundle, aclScope) ? "default" : "outline"}
                          disabled={permissionBusy}
                          onClick={() => applyBundle(selectedUser, bundle, aclScope)}
                        >
                          {bundle.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Permisos explícitos actuales</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedUser.explicitPermissions.length > 0 ? (
                        selectedUser.explicitPermissions.map((permission) => (
                          <Badge key={permission.id} variant="outline">
                            {permission.key} · {resolveScopeLabel(permission.educationalCenterId)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">sin permisos explícitos</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Matriz ACL</p>
                    <div className="space-y-3">
                      {permissionsByFeature.map((feature) => (
                        <div key={feature.featureId} className="rounded-2xl border border-border bg-white/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{feature.featureName}</p>
                              <p className="text-xs text-muted-foreground">{feature.featureCode}</p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {feature.actions.map((action) => {
                                const checked = getPermissionEntries(selectedUser, feature.featureCode, action.code, aclScope).length > 0;
                                return (
                                  <label key={action.id} className="inline-flex items-center gap-2 text-sm text-foreground">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={permissionBusy}
                                      onChange={() => togglePermission(selectedUser, feature.featureCode, action.code, aclScope)}
                                    />
                                    <span>{action.code}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
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
          <CardTitle>Usuarios que conviene revisar</CardTitle>
          <CardDescription>
            Cruce rápido entre datos incompletos y configuración de acceso explícita.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {usersQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
          ) : users.filter((item) => item.needsReview).length === 0 ? (
            <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              No aparecen usuarios con observaciones básicas. Buen momento para seguir afinando bundles o reglas.
            </div>
          ) : (
            users
              .filter((item) => item.needsReview)
              .slice(0, 6)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectUser(item)}
                  className="rounded-2xl border border-border bg-white/80 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <p className="text-sm font-semibold text-foreground">{item.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!item.educationalCenterId ? <Badge variant="outline">sin institución</Badge> : null}
                    {!item.phoneNumber ? <Badge variant="outline">sin teléfono</Badge> : null}
                    {!item.address ? <Badge variant="outline">sin dirección</Badge> : null}
                    {item.explicitPermissionKeys.length > 0 ? <Badge variant="secondary">ACL explícita</Badge> : null}
                  </div>
                </button>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
