"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Phone, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createPermission as createPermissionRequest,
  deletePermission as deletePermissionRequest,
  useAccessActions,
  useAccessAuditEvents,
  useAccessFeatures,
  usePermissions,
} from "@/features/access-control/api";
import type { PermissionRecord } from "@/features/access-control/types";
import { useAuth } from "@/features/auth/auth-context";
import { useInstitutions } from "@/features/institutions/api";
import { createUser, deleteUser, updateUser, uploadUserImage, useUsers } from "@/features/users/api";
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
type UsersFocusFilter = "all" | "review" | "no_image" | "no_acl" | "teachers" | "admins";

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

function getUserInitials(user: Pick<UserRecord, "firstName" | "lastName" | "fullName">) {
  const first = user.firstName?.trim()?.slice(0, 1) || "";
  const last = user.lastName?.trim()?.slice(0, 1) || "";
  const combined = `${first}${last}`.toUpperCase();
  if (combined) return combined;

  return user.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "US";
}

function buildUserRelationHref(pathname: string, user: Pick<UserRecord, "id" | "fullName">) {
  const params = new URLSearchParams({
    ownerUserId: user.id,
    ownerUserName: user.fullName,
  });
  return `${pathname}?${params.toString()}`;
}

function UserAvatar({
  user,
  className,
}: {
  user: Pick<UserRecord, "firstName" | "lastName" | "fullName" | "imageUrl">;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white font-semibold text-primary", className)}>
      {user.imageUrl ? (
        <img src={user.imageUrl} alt={user.fullName} className="h-full w-full object-cover" />
      ) : (
        <span>{getUserInitials(user)}</span>
      )}
    </div>
  );
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
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </select>
  );
}

export function UsersTable() {
  const { tokens, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useUsers(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const permissionsQuery = usePermissions(tokens?.accessToken);
  const actionsQuery = useAccessActions(tokens?.accessToken);
  const featuresQuery = useAccessFeatures(tokens?.accessToken);

  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [focusFilter, setFocusFilter] = useState<UsersFocusFilter>("all");
  const [mode, setMode] = useState<FormMode>("edit");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [aclScope, setAclScope] = useState<string>(GLOBAL_SCOPE);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const auditEventsQuery = useAccessAuditEvents(tokens?.accessToken, selectedUserId || undefined, 20);

  const rawUsers = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const permissions = useMemo(() => permissionsQuery.data?.data ?? [], [permissionsQuery.data?.data]);
  const actions = useMemo(() => actionsQuery.data?.data ?? [], [actionsQuery.data?.data]);
  const features = useMemo(() => featuresQuery.data?.data ?? [], [featuresQuery.data?.data]);

  const institutionsById = useMemo(
    () => new Map(institutions.map((institution) => [institution.id, institution.name])),
    [institutions],
  );

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutionsById.get(scopedInstitutionId) || scopedInstitutionId : null;
  const isInstitutionAdminView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);
  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canCreateUsers = hasAnyPermission("user:create");
  const canUpdateUsers = hasAnyPermission("user:update");
  const canDeleteUsers = hasAnyPermission("user:delete");
  const canReadAcl = hasAnyPermission("access_control:read", "access-control:read");
  const canManageAcl = hasAnyPermission(
    "access_control:create",
    "access_control:update",
    "access_control:delete",
    "access-control:create",
    "access-control:update",
    "access-control:delete",
  );
  const canApplyBundles = canUpdateUsers && canManageAcl;
  const canSubmitForm = mode === "create" ? canCreateUsers : canUpdateUsers;

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

  useEffect(() => {
    if (!scopedInstitutionId) return;
    setInstitutionFilter((current) => current || scopedInstitutionId);
    setAclScope((current) => (current === GLOBAL_SCOPE ? scopedInstitutionId : current || scopedInstitutionId));
    setForm((current) =>
      current.educationalCenterId
        ? current
        : {
            ...current,
            educationalCenterId: scopedInstitutionId,
          },
    );
  }, [scopedInstitutionId]);

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
      const matchesFocus = (() => {
        switch (focusFilter) {
          case "review":
            return item.needsReview;
          case "no_image":
            return !item.imageUrl;
          case "no_acl":
            return item.explicitPermissionKeys.length === 0;
          case "teachers":
            return item.inferredRoles.includes("teacher");
          case "admins":
            return item.inferredRoles.includes("admin") || item.inferredRoles.includes("institution-admin");
          default:
            return true;
        }
      })();

      return matchesQuery && matchesInstitution && matchesRole && matchesFocus;
    });
  }, [focusFilter, institutionFilter, institutionsById, query, roleFilter, users]);

  const pagination = useListPagination(filtered);

  const auditEventsPagination = useListPagination(auditEventsQuery.data || []);

  const metrics = useMemo(() => {
    const permissionedUsers = users.filter((item) => item.explicitPermissionKeys.length > 0).length;
    const adminLikeUsers = users.filter((item) => item.inferredRoles.includes("admin") || item.inferredRoles.includes("institution-admin")).length;
    const usersWithImage = users.filter((item) => Boolean(item.imageUrl)).length;
    const reviewUsers = users.filter((item) => item.needsReview).length;
    const usersWithoutAcl = users.filter((item) => item.explicitPermissionKeys.length === 0).length;
    const teacherUsers = users.filter((item) => item.inferredRoles.includes("teacher")).length;

    return {
      totalUsers: usersQuery.data?.total || users.length,
      permissionedUsers,
      adminLikeUsers,
      usersWithImage,
      reviewUsers,
      usersWithoutAcl,
      teacherUsers,
    };
  }, [users, usersQuery.data?.total]);

  const focusSegments = [
    { key: "all" as const, label: "Todos", count: metrics.totalUsers },
    { key: "review" as const, label: "Con observaciones", count: metrics.reviewUsers },
    { key: "no_image" as const, label: "Sin imagen", count: metrics.totalUsers - metrics.usersWithImage },
    { key: "no_acl" as const, label: "Sin ACL explícita", count: metrics.usersWithoutAcl },
    { key: "teachers" as const, label: "Docentes", count: metrics.teacherUsers },
    { key: "admins" as const, label: "Admins", count: metrics.adminLikeUsers },
  ];

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
    mutationFn: async ({ payload, imageFile }: { payload: CreateUserPayload; imageFile: File | null }) => {
      const createdUser = await createUser(tokens?.accessToken as string, payload);
      if (!imageFile) return createdUser;

      const uploadResult = await uploadUserImage(tokens?.accessToken as string, createdUser.id, imageFile);
      return {
        ...createdUser,
        imageUrl: uploadResult.imageUrl,
      };
    },
    onSuccess: async (createdUser) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["access-audit-events"] }),
      ]);
      setFeedback({ type: "success", message: "Usuario creado correctamente." });
      setMode("edit");
      setSelectedUserId(createdUser.id);
      setForm(formFromUser(createdUser));
      setImageFile(null);
      setIsFormModalOpen(false);
    },
    onError: (error) => {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, payload, imageFile }: { userId: string; payload: UpdateUserPayload; imageFile?: File | null }) => {
      const updatedUser = await updateUser(tokens?.accessToken as string, userId, payload);
      if (!imageFile) return updatedUser;

      const uploadResult = await uploadUserImage(tokens?.accessToken as string, userId, imageFile);
      return {
        ...updatedUser,
        imageUrl: uploadResult.imageUrl,
      };
    },
    onSuccess: async (updatedUser) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["access-audit-events"] }),
      ]);
      setFeedback({ type: "success", message: "Usuario actualizado correctamente." });
      setSelectedUserId(updatedUser.id);
      setForm(formFromUser(updatedUser));
      setImageFile(null);
      setIsFormModalOpen(false);
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
      setImageFile(null);
      setIsFormModalOpen(false);
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
    if (!canUpdateUsers) {
      setFeedback({ type: "error", message: "Tu acceso actual no permite persistir roles de usuario." });
      return;
    }

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

  function formatAuditEventLabel(eventType: string) {
    const labels: Record<string, string> = {
      "role.assigned": "Rol asignado",
      "role.removed": "Rol removido",
      "permission.created": "Permiso creado",
      "permission.updated": "Permiso actualizado",
      "permission.deleted": "Permiso eliminado",
      "permission.restored": "Permiso restaurado",
    };
    return labels[eventType] || eventType;
  }

  function selectUser(user: UserRow) {
    setMode("edit");
    setSelectedUserId(user.id);
    setAclScope(user.educationalCenterId || scopedInstitutionId || GLOBAL_SCOPE);
    setForm(formFromUser(user));
    setFeedback(null);
    setImageFile(null);
  }

  function openCreateUserForm() {
    setMode("create");
    setSelectedUserId(null);
    setAclScope(scopedInstitutionId || GLOBAL_SCOPE);
    setForm({
      ...emptyFormState(),
      educationalCenterId: scopedInstitutionId || "",
    });
    setFeedback(null);
    setImageFile(null);
    setIsFormModalOpen(true);
  }

  function openEditUserForm() {
    if (!selectedUser) return;
    setMode("edit");
    setSelectedUserId(selectedUser.id);
    setAclScope(selectedUser.educationalCenterId || scopedInstitutionId || GLOBAL_SCOPE);
    setForm(formFromUser(selectedUser));
    setFeedback(null);
    setImageFile(null);
    setIsFormModalOpen(true);
  }

  function closeUserForm() {
    setImageFile(null);
    setIsFormModalOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["access-audit-events"] }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);
  }

  async function togglePermission(user: UserRow, featureCode: string, actionCode: string, scope: string = GLOBAL_SCOPE) {
    if (!tokens?.accessToken) return;
    if (!canManageAcl) {
      setFeedback({ type: "error", message: "Tu acceso actual no permite editar permisos ACL." });
      return;
    }

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
    if (!canApplyBundles) {
      setFeedback({ type: "error", message: "Necesitás permiso para actualizar usuarios y ACL antes de aplicar bundles." });
      return;
    }

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

    if (!canSubmitForm) {
      setFeedback({
        type: "error",
        message: mode === "create" ? "Tu acceso actual no permite crear usuarios." : "Tu acceso actual no permite editar usuarios.",
      });
      return;
    }

    const result = buildPayload(form, mode);
    if (!result.payload) {
      setFeedback({ type: "error", message: result.error || "No se pudo preparar el payload." });
      return;
    }

    if (mode === "create") {
      await createUserMutation.mutateAsync({
        payload: result.payload as CreateUserPayload,
        imageFile,
      });
      return;
    }

    if (!selectedUserId) {
      setFeedback({ type: "error", message: "Seleccioná un usuario para editar." });
      return;
    }

    await updateUserMutation.mutateAsync({
      userId: selectedUserId,
      payload: result.payload as UpdateUserPayload,
      imageFile,
    });
  }

  async function handleDelete() {
    if (!selectedUser) return;
    if (!canDeleteUsers) {
      setFeedback({ type: "error", message: "Tu acceso actual no permite eliminar usuarios." });
      return;
    }
    if (!globalThis.confirm(`¿Eliminar a ${selectedUser.fullName}?`)) return;
    setFeedback(null);
    await deleteUserMutation.mutateAsync(selectedUser.id);
  }

  function renderUserEditorPanel() {
    return (
      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Alta de usuario" : "Editar usuario"}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? canCreateUsers
                ? "Alta inicial conectada al backend real."
                : "Tu perfil actual puede consultar usuarios, pero no dar de alta nuevos registros."
              : canUpdateUsers
                ? "Datos base del usuario, vínculo institucional y tipo de acceso."
                : "Vista de solo lectura para datos base del usuario y su contexto institucional."}
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
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={selectedUser} className="size-12 text-xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedUser.fullName}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedUser.imageUrl ? "secondary" : "outline"}>
                        {selectedUser.imageUrl ? "imagen cargada" : "sin imagen"}
                      </Badge>
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
                    <Input id="firstName" disabled={!canSubmitForm} value={form.firstName} onChange={(event) => updateFormField("firstName", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input id="lastName" disabled={!canSubmitForm} value={form.lastName} onChange={(event) => updateFormField("lastName", event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" disabled={!canSubmitForm} type="email" value={form.email} onChange={(event) => updateFormField("email", event.target.value)} />
                  </div>
                  {mode === "create" ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="password">Contraseña inicial</Label>
                      <Input id="password" disabled={!canSubmitForm} type="password" value={form.password} onChange={(event) => updateFormField("password", event.target.value)} />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Teléfono</Label>
                    <Input id="phoneNumber" disabled={!canSubmitForm} value={form.phoneNumber} onChange={(event) => updateFormField("phoneNumber", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userType">Tipo de usuario</Label>
                    <SelectField disabled={!canSubmitForm} value={form.userType} onChange={(value) => updateFormField("userType", value as UserFormState["userType"])}>
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
                            disabled={!canUpdateUsers}
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
                    <SelectField disabled={!canSubmitForm} value={form.educationalCenterId} onChange={(value) => updateFormField("educationalCenterId", value)}>
                      {!scopedInstitutionId ? <option value="">Sin institución</option> : null}
                      {institutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.name}
                        </option>
                      ))}
                    </SelectField>
                    <p className="text-xs text-muted-foreground">
                      {scopedInstitutionName
                        ? `En este modo, las altas y ediciones quedan ancladas a ${scopedInstitutionName}.`
                        : "Podés dejar el usuario sin institución o asignarlo explícitamente."}
                    </p>
                  </div>
                  <ImageUploadField
                    value={form.imageUrl}
                    file={imageFile}
                    onFileChange={setImageFile}
                    onRemoveCurrent={() => {
                      updateFormField("imageUrl", "");
                      setImageFile(null);
                    }}
                    disabled={!canSubmitForm}
                    label="Imagen de perfil"
                    description="Podés arrastrar una imagen o buscarla en la computadora. La guardamos al confirmar el alta o la edición del usuario."
                  />
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
                    {mode === "create" ? (canCreateUsers ? "Crear usuario" : "Alta bloqueada") : canUpdateUsers ? "Guardar cambios" : "Edición bloqueada"}
                  </Button>
                  {mode === "create" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode("edit");
                        if (selectedUser) setForm(formFromUser(selectedUser));
                        setFeedback(null);
                        closeUserForm();
                      }}
                    >
                      Cancelar
                    </Button>
                  ) : canDeleteUsers ? (
                    <Button type="button" variant="destructive" disabled={isSaving || !selectedUser} onClick={handleDelete}>
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
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionAdminView ? "Institution admin" : "Superadmin"}
        title="Usuarios"
        description={
          isInstitutionAdminView
            ? `La vista quedó adaptada a operación institution-admin sobre ${scopedInstitutionName}. Los listados y acciones ya respetan el scope backend.`
            : "La vista ahora conecta usuarios, roles persistidos y permisos ACL explícitos desde el backend real."
        }
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
              disabled={!canCreateUsers}
              onClick={openCreateUserForm}
            >
              <UserPlus className="size-4" />
              {canCreateUsers ? "Nuevo usuario" : "Alta no disponible"}
            </Button>
          </div>
        }
      />

      {scopedInstitutionName ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge>
        </div>
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
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
            <SummaryCard
              label="Con imagen cargada"
              value={String(metrics.usersWithImage)}
              hint="Facilita reconocimiento rápido en lectura operativa y auditoría visual." 
              icon={Users}
            />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Institución</Label>
            <SelectField value={institutionFilter} onChange={setInstitutionFilter}>
              {!scopedInstitutionId ? <option value="">Todas</option> : null}
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
            <SelectField value={focusFilter} onChange={(value) => setFocusFilter(value as UsersFocusFilter)}>
              <option value="all">Todos</option>
              <option value="review">Con observaciones</option>
              <option value="no_image">Sin imagen</option>
              <option value="no_acl">Sin ACL explícita</option>
              <option value="teachers">Docentes</option>
              <option value="admins">Admins</option>
            </SelectField>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInstitutionFilter(scopedInstitutionId || "");
                setRoleFilter("");
                setFocusFilter("all");
                setQuery("");
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap gap-2 p-5">
          {focusSegments.map((segment) => (
            <Button
              key={segment.key}
              type="button"
              size="sm"
              variant={focusFilter === segment.key ? "default" : "outline"}
              onClick={() => setFocusFilter(segment.key)}
            >
              {segment.label}
              <Badge variant={focusFilter === segment.key ? "secondary" : "outline"} className={focusFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Padrón de usuarios</CardTitle>
                <CardDescription>
                  La tabla muestra roles efectivos, cantidad de permisos explícitos y señales de revisión. Seleccioná un usuario para editar sus datos y su ACL.
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
                    pagination.paginatedItems.map((item) => {
                      const active = mode === "edit" && selectedUserId === item.id;
                      return (
                        <TableRow key={item.id} className={cn("cursor-pointer", active && "bg-primary/5")} onClick={() => selectUser(item)}>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <UserAvatar user={item} className="size-10 text-[11px]" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{item.fullName}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                              </div>
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
                              <Badge variant={item.imageUrl ? "secondary" : "outline"}>{item.imageUrl ? "imagen" : "sin imagen"}</Badge>
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
              <CardTitle>Edición y alta</CardTitle>
              <CardDescription>
                Los formularios de usuario ahora se abren como pop-up en ventanas medias/chicas para no comprimir la lectura operativa del módulo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "edit" && selectedUser ? (
                <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={selectedUser} className="size-12 text-xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedUser.fullName}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedUser.imageUrl ? "secondary" : "outline"}>
                        {selectedUser.imageUrl ? "imagen cargada" : "sin imagen"}
                      </Badge>
                      {selectedUser.inferredRoles.map((role) => (
                        <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
                  Seleccioná un usuario de la tabla para editarlo o usá el alta rápida para crear uno nuevo sin perder contexto del padrón.
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={openCreateUserForm} disabled={!canCreateUsers}>
                  <UserPlus className="size-4" />
                  {canCreateUsers ? "Nuevo usuario" : "Alta no disponible"}
                </Button>
                <Button type="button" variant="outline" onClick={openEditUserForm} disabled={!selectedUser}>
                  Editar seleccionado
                </Button>
              </div>

              {selectedUser ? (
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <p className="text-sm font-medium text-foreground">Cruces rápidos</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Abrí el parque y las partidas ya filtradas por {selectedUser.fullName} para seguir ownership y actividad sin rearmar la búsqueda.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href={buildUserRelationHref("/devices", selectedUser)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Ver dispositivos del usuario
                    </Link>
                    <Link
                      href={buildUserRelationHref("/games", selectedUser)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Ver partidas subidas
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className={cn("hidden 2xl:block", isFormModalOpen && "2xl:hidden")}>{renderUserEditorPanel()}</div>
            </CardContent>
          </Card>

          <Modal
            open={isFormModalOpen}
            onClose={closeUserForm}
            title={mode === "create" ? "Alta de usuario" : "Editar usuario"}
            description={mode === "create" ? "Completá el formulario sin salir del módulo." : "Ajustá datos base, vínculo institucional y contexto de acceso."}
            className="max-w-[1180px]"
            hideHeader
          >
            {renderUserEditorPanel()}
          </Modal>

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
              ) : !canReadAcl && !canManageAcl ? (
                <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                  Tu acceso actual permite revisar el padrón, pero no consultar ni editar ACL detallada.
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
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">Bundle target: {resolveScopeLabel(aclScope === GLOBAL_SCOPE ? null : aclScope)}</Badge>
                          {isInstitutionAdminView ? <Badge variant="secondary">Scope bloqueado a institución</Badge> : null}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Scope ACL</Label>
                        <SelectField disabled={!canManageAcl} value={aclScope} onChange={setAclScope}>
                          {!scopedInstitutionId ? <option value={GLOBAL_SCOPE}>Global</option> : null}
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
                          disabled={permissionBusy || !canApplyBundles}
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
                                      disabled={permissionBusy || !canManageAcl}
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

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Historial de acceso</CardTitle>
                  <CardDescription>
                    Últimos cambios de roles y permisos del usuario seleccionado.
                  </CardDescription>
                </div>
                <ListPaginationControls
                  pageSize={auditEventsPagination.pageSize}
                  setPageSize={auditEventsPagination.setPageSize}
                  currentPage={auditEventsPagination.currentPage}
                  totalPages={auditEventsPagination.totalPages}
                  totalItems={auditEventsPagination.totalItems}
                  paginationStart={auditEventsPagination.paginationStart}
                  paginationEnd={auditEventsPagination.paginationEnd}
                  goToPreviousPage={auditEventsPagination.goToPreviousPage}
                  goToNextPage={auditEventsPagination.goToNextPage}
                />
              </div>
            </CardHeader>
            <CardContent>
              {!selectedUser ? (
                <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                  Seleccioná un usuario para revisar el historial de ACL.
                </div>
              ) : auditEventsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              ) : auditEventsQuery.error ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {getErrorMessage(auditEventsQuery.error)}
                </div>
              ) : !auditEventsQuery.data || auditEventsQuery.data.length === 0 ? (
                <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                  Todavía no hay eventos auditados para este usuario.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditEventsPagination.paginatedItems.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-border bg-white/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{formatAuditEventLabel(event.eventType)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{event.entityType}</Badge>
                          <Badge variant="outline">{resolveScopeLabel(event.educationalCenterId)}</Badge>
                          {event.entityId ? <Badge variant="outline">{event.entityId}</Badge> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
        <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
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
                    {!item.imageUrl ? <Badge variant="outline">sin imagen</Badge> : null}
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
