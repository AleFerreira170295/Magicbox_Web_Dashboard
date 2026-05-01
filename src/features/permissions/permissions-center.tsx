"use client";

import { useMemo, useState } from "react";
import type { ComponentType, SelectHTMLAttributes } from "react";
import { AlertTriangle, KeyRound, Layers3, Search, ShieldCheck, ShieldEllipsis, UserRound } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccessActions, useAccessFeatures, usePermissions } from "@/features/access-control/api";
import { useAuth } from "@/features/auth/auth-context";
import {
  canLoadPermissionsGovernance,
  canReadAclContract,
  canReadFeatureContract,
  hasAnyUserPermission,
  hasInstitutionAdminPermissionsContractGap,
  isAdminSession,
  isInstitutionAdminSession,
} from "@/features/auth/permission-contract";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useInstitutions } from "@/features/institutions/api";
import { useUsers } from "@/features/users/api";
import { cn, getErrorMessage } from "@/lib/utils";

const permissionsMessages: Record<AppLanguage, {
  header: {
    eyebrowInstitution: string;
    eyebrowAdmin: string;
    title: string;
    descriptionInstitution: string;
    descriptionAdmin: string;
  };
  status: {
    institutionalRead: string;
    globalGovernance: string;
    aclReadable: string;
    aclBlocked: string;
    featuresReadable: string;
    featuresBlocked: string;
    incompleteContract: string;
    contractGap: string;
    contractOk: string;
    adminOk: string;
    whatToCheck: string;
    whatToCheckDescription: string;
  };
  alerts: {
    contractGapTitle: string;
    aclUnavailableTitle: string;
    contractGapDescription: string;
    aclUnavailableDescription: string;
    fatalTitle: string;
  };
  summaries: {
    actions: string;
    features: string;
    permissions: string;
    overrideUsers: string;
  };
  catalog: {
    title: string;
    description: string;
    actionsAvailable: string;
    noActions: string;
    featuresAvailable: string;
    noFeatures: string;
    noExplicitPermissions: string;
    permissionsToday: (globalCount: number, scopedCount: number) => string;
  };
  session: {
    title: string;
    description: string;
    noName: string;
    noEmail: string;
    effectiveRoles: string;
    noRoles: string;
    visibleExplicitPermissions: string;
    noExplicitPermissions: string;
    rolelessProfiles: string;
    brokenReferences: string;
  };
  filters: {
    title: string;
    description: string;
    search: string;
    searchPlaceholder: string;
    feature: string;
    action: string;
    scope: string;
    signal: string;
    allFem: string;
    allMasc: string;
  };
  shortcuts: {
    title: string;
    description: string;
    visible: (count: number) => string;
    all: string;
    institutionScope: string;
    global: string;
    missingReferences: string;
    withoutRole: string;
    explicitOverrides: string;
  };
  tables: {
    actionsTitle: string;
    actionsDescription: string;
    action: string;
    name: string;
    description: string;
    updated: string;
    noLoadedActions: string;
    explicitOverridesTitle: string;
    explicitOverridesDescription: string;
    user: string;
    feature: string;
    scope: string;
    signal: string;
    noOverrides: string;
    profilesTitle: string;
    profilesDescription: string;
    noUsersRead: string;
    institution: string;
    roles: string;
    permissions: string;
    noProfiles: string;
  };
}> = {
  es: {
    header: { eyebrowInstitution: "Institution admin", eyebrowAdmin: "Superadmin", title: "Permisos y gobernanza", descriptionInstitution: "Vista acotada por alcance institucional para revisar ACL disponible, overrides visibles y desvíos que conviene atender primero.", descriptionAdmin: "Mesa de trabajo para leer el contrato ACL real, detectar overrides y revisar rápido dónde hay inconsistencias operativas." },
    status: { institutionalRead: "lectura institucional", globalGovernance: "gobernanza global", aclReadable: "ACL legible", aclBlocked: "ACL bloqueada", featuresReadable: "features legibles", featuresBlocked: "features bloqueadas", incompleteContract: "contrato incompleto", contractGap: "La sesión llegó sin ACL/feature read, aunque este perfil debería poder revisar Permissions. Esto ya se trata como desalineación de contrato, no como ausencia intencional del módulo.", contractOk: "Esta sesión cumple el contrato esperado para revisar ACL institucional y overrides dentro del alcance visible.", adminOk: "La pantalla ya está consolidada como lectura operativa del contrato ACL compartido entre dashboard y backend.", whatToCheck: "Qué mirar primero", whatToCheckDescription: "Arrancá por overrides explícitos, referencias incompletas y perfiles sin rol antes de bajar al catálogo completo." },
    alerts: { contractGapTitle: "Sesión institution-admin sin contrato ACL completo", aclUnavailableTitle: "Lectura ACL no disponible para esta sesión", contractGapDescription: "Bajo el contrato actual del producto, institution-admin debería llegar con lectura de access-control y feature. La UI ya expone el módulo porque el perfil sí debe tenerlo, pero esta sesión concreta no trae las capacidades esperadas.", aclUnavailableDescription: "Esta vista necesita al menos lectura sobre access-control y feature para cargar gobernanza real.", fatalTitle: "No pudimos cargar la gobernanza ACL real" },
    summaries: { actions: "Actions activas", features: "Features modeladas", permissions: "Permisos explícitos", overrideUsers: "Usuarios con override" },
    catalog: { title: "Catálogo ACL operativo", description: "Acciones, features y volumen real de overrides. Esto ya sirve para validar el backend, no solo para explicar el modelo.", actionsAvailable: "Actions disponibles", noActions: "sin actions", featuresAvailable: "Features disponibles", noFeatures: "sin features", noExplicitPermissions: "Todavía no hay permisos explícitos activos. El sistema está apoyándose sobre roles base y alcance implícito.", permissionsToday: (g, s) => `Hoy vemos ${g} overrides globales y ${s} overrides con scope institucional.` },
    session: { title: "Sesión actual y señales de revisión", description: "Lectura rápida del actor autenticado y de los desvíos que conviene revisar primero.", noName: "Sin nombre", noEmail: "Sin email", effectiveRoles: "Roles efectivos", noRoles: "sin roles", visibleExplicitPermissions: "Permisos explícitos visibles", noExplicitPermissions: "sin permisos explícitos", rolelessProfiles: "Perfiles sin rol", brokenReferences: "Referencias rotas" },
    filters: { title: "Filtros operativos", description: "Primero filtros, después lectura acotada. Así la pantalla empieza a servir como mesa de trabajo real sobre ACL.", search: "Buscar", searchPlaceholder: "Usuario, feature, action, scope o señal", feature: "Feature", action: "Action", scope: "Scope", signal: "Señal", allFem: "Todas", allMasc: "Todos" },
    shortcuts: { title: "Recortes rápidos", description: "Usá estas vistas para entrar directo a señales críticas sin tocar todos los filtros.", visible: (count) => `${count} visibles`, all: "Todos", institutionScope: "Scope institucional", global: "Globales", missingReferences: "Referencias incompletas", withoutRole: "Sin rol", explicitOverrides: "Overrides explícitos" },
    tables: { actionsTitle: "Catálogo de actions", actionsDescription: "El endpoint real de actions ahora queda visible en la UI y deja de ser una dependencia implícita del módulo.", action: "Action", name: "Nombre", description: "Descripción", updated: "Actualizada", noLoadedActions: "No hay actions cargadas.", explicitOverridesTitle: "Overrides explícitos vigentes", explicitOverridesDescription: "Tabla filtrable para cruzar usuario, feature, action y scope institucional sin salir del dashboard.", user: "Usuario", feature: "Feature", scope: "Scope", signal: "Señal", noOverrides: "No hay overrides que coincidan con los filtros actuales.", profilesTitle: "Perfiles que conviene revisar", profilesDescription: "Usuarios sin rol o con overrides explícitos, para que el módulo también funcione como cola de revisión.", noUsersRead: "La sesión actual puede leer ACL, pero no expone lectura de usuarios suficiente para construir esta cola de revisión.", institution: "Institución", roles: "Roles", permissions: "Permisos", noProfiles: "No hay perfiles marcados para revisión con los filtros actuales." },
  },
  en: {
    header: { eyebrowInstitution: "Institution admin", eyebrowAdmin: "Superadmin", title: "Permissions and governance", descriptionInstitution: "Institution-scoped view to review available ACL, visible overrides, and the deviations worth addressing first.", descriptionAdmin: "Work table to read the real ACL contract, detect overrides, and quickly spot operational inconsistencies." },
    status: { institutionalRead: "institutional read", globalGovernance: "global governance", aclReadable: "ACL readable", aclBlocked: "ACL blocked", featuresReadable: "features readable", featuresBlocked: "features blocked", incompleteContract: "incomplete contract", contractGap: "This session arrived without ACL/feature read even though this profile should be able to review Permissions. This is treated as a contract misalignment, not as an intentional absence of the module.", contractOk: "This session meets the expected contract to review institutional ACL and overrides within the visible scope.", adminOk: "This screen is already consolidated as an operational read of the ACL contract shared between dashboard and backend.", whatToCheck: "What to check first", whatToCheckDescription: "Start with explicit overrides, incomplete references, and users without roles before going down to the full catalog." },
    alerts: { contractGapTitle: "Institution-admin session without full ACL contract", aclUnavailableTitle: "ACL read unavailable for this session", contractGapDescription: "Under the current product contract, institution-admin should arrive with access-control and feature read. The UI still exposes the module because the profile should have it, but this specific session does not bring the expected capabilities.", aclUnavailableDescription: "This view needs at least access-control and feature read to load real governance.", fatalTitle: "We couldn't load the real ACL governance" },
    summaries: { actions: "Active actions", features: "Modeled features", permissions: "Explicit permissions", overrideUsers: "Users with overrides" },
    catalog: { title: "Operational ACL catalog", description: "Actions, features, and real override volume. This already helps validate the backend, not just explain the model.", actionsAvailable: "Available actions", noActions: "no actions", featuresAvailable: "Available features", noFeatures: "no features", noExplicitPermissions: "There are no active explicit permissions yet. The system is relying on base roles and implicit scope.", permissionsToday: (g, s) => `Today we see ${g} global overrides and ${s} institutional-scope overrides.` },
    session: { title: "Current session and review signals", description: "Quick read of the authenticated actor and the deviations worth reviewing first.", noName: "No name", noEmail: "No email", effectiveRoles: "Effective roles", noRoles: "no roles", visibleExplicitPermissions: "Visible explicit permissions", noExplicitPermissions: "no explicit permissions", rolelessProfiles: "Profiles without role", brokenReferences: "Broken references" },
    filters: { title: "Operational filters", description: "Filters first, then narrowed reading. That way the screen starts acting like a real ACL workbench.", search: "Search", searchPlaceholder: "User, feature, action, scope, or signal", feature: "Feature", action: "Action", scope: "Scope", signal: "Signal", allFem: "All", allMasc: "All" },
    shortcuts: { title: "Quick slices", description: "Use these views to jump straight to critical signals without touching every filter.", visible: (count) => `${count} visible`, all: "All", institutionScope: "Institution scope", global: "Global", missingReferences: "Incomplete references", withoutRole: "Without role", explicitOverrides: "Explicit overrides" },
    tables: { actionsTitle: "Actions catalog", actionsDescription: "The real actions endpoint is now visible in the UI and stops being an implicit module dependency.", action: "Action", name: "Name", description: "Description", updated: "Updated", noLoadedActions: "No actions loaded.", explicitOverridesTitle: "Active explicit overrides", explicitOverridesDescription: "Filterable table to cross user, feature, action, and institutional scope without leaving the dashboard.", user: "User", feature: "Feature", scope: "Scope", signal: "Signal", noOverrides: "No overrides match the current filters.", profilesTitle: "Profiles worth reviewing", profilesDescription: "Users without role or with explicit overrides, so the module also works as a review queue.", noUsersRead: "The current session can read ACL, but it doesn't expose enough user read to build this review queue.", institution: "Institution", roles: "Roles", permissions: "Permissions", noProfiles: "No profiles marked for review with the current filters." },
  },
  pt: {
    header: { eyebrowInstitution: "Institution admin", eyebrowAdmin: "Superadmin", title: "Permissões e governança", descriptionInstitution: "Visão limitada ao alcance institucional para revisar ACL disponível, overrides visíveis e desvios que valem atenção primeiro.", descriptionAdmin: "Mesa de trabalho para ler o contrato ACL real, detectar overrides e encontrar rapidamente inconsistências operacionais." },
    status: { institutionalRead: "leitura institucional", globalGovernance: "governança global", aclReadable: "ACL legível", aclBlocked: "ACL bloqueada", featuresReadable: "features legíveis", featuresBlocked: "features bloqueadas", incompleteContract: "contrato incompleto", contractGap: "Esta sessão chegou sem ACL/feature read, embora este perfil devesse poder revisar Permissions. Isso já é tratado como desalinhamento de contrato, não como ausência intencional do módulo.", contractOk: "Esta sessão cumpre o contrato esperado para revisar ACL institucional e overrides dentro do alcance visível.", adminOk: "A tela já está consolidada como leitura operacional do contrato ACL compartilhado entre dashboard e backend.", whatToCheck: "O que olhar primeiro", whatToCheckDescription: "Comece por overrides explícitos, referências incompletas e perfis sem papel antes de descer ao catálogo completo." },
    alerts: { contractGapTitle: "Sessão institution-admin sem contrato ACL completo", aclUnavailableTitle: "Leitura ACL indisponível para esta sessão", contractGapDescription: "Pelo contrato atual do produto, institution-admin deveria chegar com leitura de access-control e feature. A UI já expõe o módulo porque o perfil deve tê-lo, mas esta sessão específica não traz as capacidades esperadas.", aclUnavailableDescription: "Esta visão precisa ao menos de leitura sobre access-control e feature para carregar governança real.", fatalTitle: "Não foi possível carregar a governança ACL real" },
    summaries: { actions: "Actions ativas", features: "Features modeladas", permissions: "Permissões explícitas", overrideUsers: "Usuários com override" },
    catalog: { title: "Catálogo ACL operacional", description: "Ações, features e volume real de overrides. Isso já serve para validar o backend, não só para explicar o modelo.", actionsAvailable: "Actions disponíveis", noActions: "sem actions", featuresAvailable: "Features disponíveis", noFeatures: "sem features", noExplicitPermissions: "Ainda não há permissões explícitas ativas. O sistema está se apoiando em papéis base e alcance implícito.", permissionsToday: (g, s) => `Hoje vemos ${g} overrides globais e ${s} overrides com escopo institucional.` },
    session: { title: "Sessão atual e sinais de revisão", description: "Leitura rápida do ator autenticado e dos desvios que convém revisar primeiro.", noName: "Sem nome", noEmail: "Sem email", effectiveRoles: "Papéis efetivos", noRoles: "sem papéis", visibleExplicitPermissions: "Permissões explícitas visíveis", noExplicitPermissions: "sem permissões explícitas", rolelessProfiles: "Perfis sem papel", brokenReferences: "Referências quebradas" },
    filters: { title: "Filtros operacionais", description: "Primeiro filtros, depois leitura recortada. Assim a tela começa a servir como mesa de trabalho real sobre ACL.", search: "Buscar", searchPlaceholder: "Usuário, feature, action, scope ou sinal", feature: "Feature", action: "Action", scope: "Scope", signal: "Sinal", allFem: "Todas", allMasc: "Todos" },
    shortcuts: { title: "Recortes rápidos", description: "Use estas visões para entrar direto em sinais críticos sem tocar todos os filtros.", visible: (count) => `${count} visíveis`, all: "Todos", institutionScope: "Escopo institucional", global: "Globais", missingReferences: "Referências incompletas", withoutRole: "Sem papel", explicitOverrides: "Overrides explícitos" },
    tables: { actionsTitle: "Catálogo de actions", actionsDescription: "O endpoint real de actions agora fica visível na UI e deixa de ser uma dependência implícita do módulo.", action: "Action", name: "Nome", description: "Descrição", updated: "Atualizada", noLoadedActions: "Não há actions carregadas.", explicitOverridesTitle: "Overrides explícitos vigentes", explicitOverridesDescription: "Tabela filtrável para cruzar usuário, feature, action e escopo institucional sem sair do dashboard.", user: "Usuário", feature: "Feature", scope: "Scope", signal: "Sinal", noOverrides: "Não há overrides que coincidam com os filtros atuais.", profilesTitle: "Perfis que convém revisar", profilesDescription: "Usuários sem papel ou com overrides explícitos, para que o módulo também funcione como fila de revisão.", noUsersRead: "A sessão atual pode ler ACL, mas não expõe leitura de usuários suficiente para construir esta fila de revisão.", institution: "Instituição", roles: "Papéis", permissions: "Permissões", noProfiles: "Não há perfis marcados para revisão com os filtros atuais." },
  },
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}

function formatScopeLabel(scopeId: string | null | undefined, globalLabel: string, institutionName?: string | null) {
  if (!scopeId) return globalLabel;
  return institutionName?.trim() || scopeId;
}

export function PermissionsCenter() {
  const { language } = useLanguage();
  const t = permissionsMessages[language];
  const globalScopeLabel = "Global";
  const { tokens, user } = useAuth();
  const [query, setQuery] = useState("");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");

  const currentPermissions = user?.permissions || [];
  const isAdminView = isAdminSession(user);
  const isInstitutionAdminView = !isAdminView && isInstitutionAdminSession(user);

  const canReadAcl = canReadAclContract(user);
  const canReadFeatureCatalog = canReadFeatureContract(user);
  const canReadUsers = isAdminView || hasAnyUserPermission(user, "user:read");
  const canReadInstitutions =
    isAdminView ||
    hasAnyUserPermission(
      user,
      "educational_center:read",
      "educational-center:read",
      "educational_center:read:any",
      "educational-center:read:any",
    );

  const actionsQuery = useAccessActions(canReadAcl ? tokens?.accessToken : undefined);
  const featuresQuery = useAccessFeatures(canReadFeatureCatalog ? tokens?.accessToken : undefined);
  const permissionsQuery = usePermissions(canReadAcl ? tokens?.accessToken : undefined);
  const usersQuery = useUsers(canReadUsers ? tokens?.accessToken : undefined);
  const institutionsQuery = useInstitutions(canReadInstitutions ? tokens?.accessToken : undefined);

  const actions = useMemo(() => actionsQuery.data?.data || [], [actionsQuery.data]);
  const features = useMemo(() => featuresQuery.data?.data || [], [featuresQuery.data]);
  const permissions = useMemo(() => permissionsQuery.data?.data || [], [permissionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);

  const loading =
    (canReadAcl && actionsQuery.isLoading) ||
    (canReadFeatureCatalog && featuresQuery.isLoading) ||
    (canReadAcl && permissionsQuery.isLoading) ||
    (canReadUsers && usersQuery.isLoading) ||
    (canReadInstitutions && institutionsQuery.isLoading);

  const fatalError =
    actionsQuery.error ||
    featuresQuery.error ||
    permissionsQuery.error ||
    usersQuery.error ||
    institutionsQuery.error;

  const model = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const userById = new Map(users.map((item) => [item.id, item]));
    const featureById = new Map(features.map((item) => [item.id, item]));
    const actionById = new Map(actions.map((item) => [item.id, item]));
    const institutionById = new Map(institutions.map((item) => [item.id, item]));

    const permissionRows = permissions.map((item) => {
      const actor = userById.get(item.userId);
      const feature = featureById.get(item.featureId);
      const action = actionById.get(item.actionId);
      const institution = item.educationalCenterId ? institutionById.get(item.educationalCenterId) : undefined;
      const scopeLabel = formatScopeLabel(item.educationalCenterId, globalScopeLabel, institution?.name);
      const signal = !actor || !feature || !action ? "referencia incompleta" : item.educationalCenterId ? "scope institucional" : "global";

      return {
        id: item.id,
        userName: actor?.fullName || "Usuario no resuelto",
        userEmail: actor?.email || item.userId,
        roleSummary: actor?.roles.length ? actor.roles.join(", ") : "sin rol",
        featureCode: feature?.code || item.featureId,
        actionCode: action?.code || item.actionId,
        scopeId: item.educationalCenterId || null,
        scopeLabel,
        signal,
        hasReferenceGap: !actor || !feature || !action,
        searchText: [
          actor?.fullName,
          actor?.email,
          feature?.code,
          action?.code,
          scopeLabel,
          signal,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

    const filteredPermissionRows = permissionRows.filter((item) => {
      if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
      if (featureFilter !== "all" && item.featureCode !== featureFilter) return false;
      if (actionFilter !== "all" && item.actionCode !== actionFilter) return false;
      if (scopeFilter === "global" && item.scopeId) return false;
      if (scopeFilter !== "all" && scopeFilter !== "global" && item.scopeId !== scopeFilter) return false;
      if (signalFilter !== "all" && item.signal !== signalFilter) return false;
      return true;
    });

    const reviewProfiles = users
      .filter((item) => item.roles.length === 0 || item.permissions.length > 0)
      .map((item) => {
        const institution = item.educationalCenterId ? institutionById.get(item.educationalCenterId) : undefined;
        const signal = item.roles.length === 0 ? "sin rol" : item.permissions.length > 0 ? "override explícito" : "revisar";
        return {
          id: item.id,
          fullName: item.fullName,
          email: item.email,
          institutionLabel: formatScopeLabel(item.educationalCenterId, globalScopeLabel, institution?.name),
          roles: item.roles,
          permissions: item.permissions,
          signal,
          searchText: [item.fullName, item.email, institution?.name, item.roles.join(" "), item.permissions.join(" "), signal]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        };
      });

    const filteredReviewProfiles = reviewProfiles
      .filter((item) => {
        if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
        if (scopeFilter === "global" && item.institutionLabel !== globalScopeLabel) return false;
        if (scopeFilter !== "all" && scopeFilter !== "global") {
          const institution = institutionById.get(scopeFilter);
          if (item.institutionLabel !== formatScopeLabel(scopeFilter, globalScopeLabel, institution?.name)) return false;
        }
        if (signalFilter === "sin rol" && item.signal !== "sin rol") return false;
        if (signalFilter === "override explícito" && item.signal !== "override explícito") return false;
        return true;
      })
      .slice(0, 12);

    return {
      explicitPermissionUsers: new Set(permissions.map((item) => item.userId)).size,
      scopedPermissions: permissions.filter((item) => item.educationalCenterId).length,
      globalPermissions: permissions.filter((item) => !item.educationalCenterId).length,
      missingReferences: permissionRows.filter((item) => item.hasReferenceGap).length,
      scopedInstitutionalSignals: permissionRows.filter((item) => item.signal === "scope institucional").length,
      reviewWithoutRole: reviewProfiles.filter((item) => item.signal === "sin rol").length,
      reviewWithOverrides: reviewProfiles.filter((item) => item.signal === "override explícito").length,
      permissionRows: filteredPermissionRows,
      reviewProfiles: filteredReviewProfiles,
      allPermissionRows: permissionRows,
      availableScopes: [
        { value: "global", label: "Global" },
        ...institutions.map((item) => ({ value: item.id, label: item.name })),
      ],
      availableSignals: Array.from(new Set(permissionRows.map((item) => item.signal))),
    };
  }, [actions, featureFilter, features, institutions, permissions, query, scopeFilter, signalFilter, actionFilter, users]);

  const actionsPagination = useListPagination(actions);
  const permissionRowsPagination = useListPagination(model.permissionRows);
  const reviewProfilesPagination = useListPagination(model.reviewProfiles);

  const canRenderGovernance = canLoadPermissionsGovernance(user);
  const hasContractGap = hasInstitutionAdminPermissionsContractGap(user);

  return (
    <div className="min-w-0 space-y-6">
      <SectionHeader
        eyebrow={isInstitutionAdminView ? t.header.eyebrowInstitution : t.header.eyebrowAdmin}
        title={t.header.title}
        description={
          isInstitutionAdminView
            ? t.header.descriptionInstitution
            : t.header.descriptionAdmin
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge variant={isInstitutionAdminView ? "secondary" : "warning"}>
                {isInstitutionAdminView ? t.status.institutionalRead : t.status.globalGovernance}
              </Badge>
              <Badge variant={canReadAcl ? "secondary" : "outline"}>{canReadAcl ? t.status.aclReadable : t.status.aclBlocked}</Badge>
              <Badge variant={canReadFeatureCatalog ? "secondary" : "outline"}>
                {canReadFeatureCatalog ? t.status.featuresReadable : t.status.featuresBlocked}
              </Badge>
              {hasContractGap ? <Badge variant="warning">{t.status.incompleteContract}</Badge> : null}
            </div>
            <p className="max-w-4xl break-words text-sm leading-6 text-muted-foreground">
              {hasContractGap
                ? t.status.contractGap
                : isInstitutionAdminView
                ? t.status.contractOk
                : t.status.adminOk}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border/70 bg-white/80 px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t.status.whatToCheck}</p>
            <p className="mt-2 leading-6">{t.status.whatToCheckDescription}</p>
          </div>
        </CardContent>
      </Card>

      {!canRenderGovernance ? (
        <Card className={cn(
          "shadow-[0_16px_40px_rgba(31,42,55,0.06)]",
          hasContractGap ? "border-warning/40 bg-warning/5" : "border-border/80 bg-card/95",
        )}>
          <CardHeader>
            <CardTitle>{hasContractGap ? t.alerts.contractGapTitle : t.alerts.aclUnavailableTitle}</CardTitle>
            <CardDescription>
              {hasContractGap
                ? t.alerts.contractGapDescription
                : t.alerts.aclUnavailableDescription}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label={t.summaries.actions}
              value={String(actions.length)}
              icon={KeyRound}
            />
            <SummaryCard
              label={t.summaries.features}
              value={String(features.length)}
              icon={Layers3}
            />
            <SummaryCard
              label={t.summaries.permissions}
              value={String(permissions.length)}
              icon={ShieldEllipsis}
            />
            <SummaryCard
              label={t.summaries.overrideUsers}
              value={String(model.explicitPermissionUsers)}
              icon={UserRound}
            />
          </>
        )}
      </div>

      {fatalError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle className="text-destructive">{t.alerts.fatalTitle}</CardTitle>
            <CardDescription>{getErrorMessage(fatalError)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <Card className="min-w-0 border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.catalog.title}</CardTitle>
            <CardDescription>
              {t.catalog.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                {t.catalog.actionsAvailable}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.length ? actions.map((action) => (
                  <Badge key={action.id} variant="secondary">{action.code}</Badge>
                )) : <Badge variant="outline">{t.catalog.noActions}</Badge>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Layers3 className="size-4 text-primary" />
                {t.catalog.featuresAvailable}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {features.length ? features.map((feature) => (
                  <Badge key={feature.id} variant="outline">{feature.code}</Badge>
                )) : <Badge variant="outline">{t.catalog.noFeatures}</Badge>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {permissions.length === 0
                ? t.catalog.noExplicitPermissions
                : t.catalog.permissionsToday(model.globalPermissions, model.scopedPermissions)}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.session.title}</CardTitle>
            <CardDescription>
              {t.session.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{user?.fullName || t.session.noName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || t.session.noEmail}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">{t.session.effectiveRoles}</p>
              <div className="mt-2 flex flex-wrap gap-2.5 rounded-2xl border border-border/70 bg-white/72 p-3">
                {user?.roles.length ? user.roles.map((role) => (
                  <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                )) : <Badge variant="outline">{t.session.noRoles}</Badge>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">{t.session.visibleExplicitPermissions}</p>
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-border/70 bg-white/72 p-3">
                {currentPermissions.length ? currentPermissions.map((permission) => (
                  <Badge key={permission} variant="outline">{permission}</Badge>
                )) : <Badge variant="outline">{t.session.noExplicitPermissions}</Badge>}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t.session.rolelessProfiles}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {loading || !canReadUsers ? "-" : String(users.filter((item) => item.roles.length === 0).length)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t.session.brokenReferences}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{loading ? "-" : String(model.missingReferences)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>{t.filters.title}</CardTitle>
          <CardDescription>
            {t.filters.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-2 md:col-span-2 xl:col-span-1">
            <Label htmlFor="permissions-query">{t.filters.search}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="permissions-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.filters.searchPlaceholder}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-feature-filter">{t.filters.feature}</Label>
            <SelectField id="permissions-feature-filter" value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)}>
              <option value="all">{t.filters.allFem}</option>
              {features.map((feature) => (
                <option key={feature.id} value={feature.code}>{feature.code}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-action-filter">{t.filters.action}</Label>
            <SelectField id="permissions-action-filter" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              <option value="all">{t.filters.allFem}</option>
              {actions.map((action) => (
                <option key={action.id} value={action.code}>{action.code}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-scope-filter">{t.filters.scope}</Label>
            <SelectField id="permissions-scope-filter" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
              <option value="all">{t.filters.allMasc}</option>
              {model.availableScopes.map((scope) => (
                <option key={scope.value} value={scope.value}>{scope.label}</option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions-signal-filter">{t.filters.signal}</Label>
            <SelectField id="permissions-signal-filter" value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)}>
              <option value="all">{t.filters.allFem}</option>
              <option value="sin rol">sin rol</option>
              <option value="override explícito">override explícito</option>
              {model.availableSignals.map((signal) => (
                <option key={signal} value={signal}>{signal}</option>
              ))}
            </SelectField>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t.shortcuts.title}</p>
              <p className="text-sm text-muted-foreground">{t.shortcuts.description}</p>
            </div>
            <Badge variant="outline">{t.shortcuts.visible(model.permissionRows.length)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={scopeFilter === "all" && signalFilter === "all" && query === "" ? "default" : "outline"}
            onClick={() => {
              setQuery("");
              setFeatureFilter("all");
              setActionFilter("all");
              setScopeFilter("all");
              setSignalFilter("all");
            }}
          >
            {t.shortcuts.all}
            <Badge variant="outline">{permissions.length}</Badge>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={signalFilter === "scope institucional" ? "default" : "outline"}
            onClick={() => {
              setQuery("");
              setScopeFilter("all");
              setSignalFilter("scope institucional");
            }}
          >
            {t.shortcuts.institutionScope}
            <Badge variant="outline">{model.scopedInstitutionalSignals}</Badge>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scopeFilter === "global" ? "default" : "outline"}
            onClick={() => {
              setQuery("");
              setSignalFilter("all");
              setScopeFilter("global");
            }}
          >
            {t.shortcuts.global}
            <Badge variant="outline">{model.globalPermissions}</Badge>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={signalFilter === "referencia incompleta" ? "default" : "outline"}
            onClick={() => {
              setQuery("");
              setScopeFilter("all");
              setSignalFilter("referencia incompleta");
            }}
          >
            {t.shortcuts.missingReferences}
            <Badge variant="outline">{model.missingReferences}</Badge>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={signalFilter === "sin rol" ? "default" : "outline"}
            onClick={() => {
              setQuery("");
              setScopeFilter("all");
              setSignalFilter("sin rol");
            }}
          >
            {t.shortcuts.withoutRole}
            <Badge variant="outline">{model.reviewWithoutRole}</Badge>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={signalFilter === "override explícito" ? "default" : "outline"}
            onClick={() => {
              setQuery("");
              setScopeFilter("all");
              setSignalFilter("override explícito");
            }}
          >
            {t.shortcuts.explicitOverrides}
            <Badge variant="outline">{model.reviewWithOverrides}</Badge>
          </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{t.tables.actionsTitle}</CardTitle>
              <CardDescription>
                {t.tables.actionsDescription}
              </CardDescription>
            </div>
            <ListPaginationControls
              pageSize={actionsPagination.pageSize}
              setPageSize={actionsPagination.setPageSize}
              currentPage={actionsPagination.currentPage}
              totalPages={actionsPagination.totalPages}
              totalItems={actionsPagination.totalItems}
              paginationStart={actionsPagination.paginationStart}
              paginationEnd={actionsPagination.paginationEnd}
              goToPreviousPage={actionsPagination.goToPreviousPage}
              goToNextPage={actionsPagination.goToNextPage}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-60 w-full rounded-none" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tables.action}</TableHead>
                  <TableHead>{t.tables.name}</TableHead>
                  <TableHead>{t.tables.description}</TableHead>
                  <TableHead>{t.tables.updated}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      {t.tables.noLoadedActions}
                    </TableCell>
                  </TableRow>
                ) : (
                  actionsPagination.paginatedItems.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell><Badge variant="secondary">{action.code}</Badge></TableCell>
                      <TableCell className="font-medium text-foreground">{action.name}</TableCell>
                      <TableCell>{action.description || "-"}</TableCell>
                      <TableCell>{action.updatedAt || action.createdAt || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{t.tables.explicitOverridesTitle}</CardTitle>
              <CardDescription>
                {t.tables.explicitOverridesDescription}
              </CardDescription>
            </div>
            <ListPaginationControls
              pageSize={permissionRowsPagination.pageSize}
              setPageSize={permissionRowsPagination.setPageSize}
              currentPage={permissionRowsPagination.currentPage}
              totalPages={permissionRowsPagination.totalPages}
              totalItems={permissionRowsPagination.totalItems}
              paginationStart={permissionRowsPagination.paginationStart}
              paginationEnd={permissionRowsPagination.paginationEnd}
              goToPreviousPage={permissionRowsPagination.goToPreviousPage}
              goToNextPage={permissionRowsPagination.goToNextPage}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tables.user}</TableHead>
                  <TableHead>{t.tables.feature}</TableHead>
                  <TableHead>{t.tables.action}</TableHead>
                  <TableHead>{t.tables.scope}</TableHead>
                  <TableHead>{t.tables.signal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.permissionRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {t.tables.noOverrides}
                    </TableCell>
                  </TableRow>
                ) : (
                  permissionRowsPagination.paginatedItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{row.userName}</p>
                          <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                          <p className="text-xs text-muted-foreground">{row.roleSummary}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{row.featureCode}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{row.actionCode}</Badge></TableCell>
                      <TableCell>{row.scopeLabel}</TableCell>
                      <TableCell>
                        {row.hasReferenceGap ? (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="size-3" />
                            referencia incompleta
                          </Badge>
                        ) : (
                          <Badge variant="outline">{row.signal}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{t.tables.profilesTitle}</CardTitle>
              <CardDescription>
                {t.tables.profilesDescription}
              </CardDescription>
            </div>
            <ListPaginationControls
              pageSize={reviewProfilesPagination.pageSize}
              setPageSize={reviewProfilesPagination.setPageSize}
              currentPage={reviewProfilesPagination.currentPage}
              totalPages={reviewProfilesPagination.totalPages}
              totalItems={reviewProfilesPagination.totalItems}
              paginationStart={reviewProfilesPagination.paginationStart}
              paginationEnd={reviewProfilesPagination.paginationEnd}
              goToPreviousPage={reviewProfilesPagination.goToPreviousPage}
              goToNextPage={reviewProfilesPagination.goToNextPage}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : !canReadUsers ? (
            <div className="p-6 text-sm leading-6 text-muted-foreground">
              {t.tables.noUsersRead}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tables.user}</TableHead>
                  <TableHead>{t.tables.institution}</TableHead>
                  <TableHead>{t.tables.roles}</TableHead>
                  <TableHead>{t.tables.permissions}</TableHead>
                  <TableHead>{t.tables.signal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.reviewProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {t.tables.noProfiles}
                    </TableCell>
                  </TableRow>
                ) : (
                  reviewProfilesPagination.paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{item.fullName}</p>
                          <p className="text-xs text-muted-foreground">{item.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.institutionLabel}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.roles.length ? item.roles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "warning" : "secondary"}>{role}</Badge>
                          )) : <Badge variant="outline">sin rol</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.permissions.length ? item.permissions.map((permission) => (
                            <Badge key={permission} variant="outline">{permission}</Badge>
                          )) : <Badge variant="outline">sin permisos explícitos</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.signal === "sin rol" ? "warning" : "secondary"}>{item.signal}</Badge>
                      </TableCell>
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
