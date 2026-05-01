"use client";

import { type ComponentType, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  History,
  LockKeyhole,
  RadioTower,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccessActions, useAccessFeatures } from "@/features/access-control/api";
import { useAuth } from "@/features/auth/auth-context";
import { useBasicHealth, useReadinessHealth } from "@/features/health/api";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { activateOtaRelease, createOtaRelease, useOtaRelease, useOtaReleases } from "@/features/settings/api";
import type { OtaReleaseRecord } from "@/features/settings/types";
import { appConfig } from "@/lib/api/config";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

const settingsMessages: Record<AppLanguage, {
  header: { eyebrow: string; title: string; description: string };
  summaries: { environment: string; readiness: string; features: string; actions: string; ota: string; yes: string; no: string };
  errors: { invalidSession: string; selectBin: string; publishSuccess: (version: string) => string; activateSuccess: (version: string) => string; loadError: (message: string) => string };
  runtime: { runtime: string; otaEditor: string; superadmin: string; heroTitle: string; heroDescription: string; runtimeLabel: string; aclLabel: string; otaLabel: string; noRelease: string };
  context: { title: string; description: string; appName: string; apiBaseUrl: string; defaultRole: string; currentSession: string; noEmail: string };
  cards: { auth: string; authDesc: (roles: number, permissions: number) => string; sync: string; syncDesc: (readiness: string, degraded: number) => string; featureFlags: string; featureFlagsDesc: (features: number, actions: number) => string; ota: string; otaDesc: (releases: number, channel: string) => string; connected: string; empty: string; healthy: string; review: string; cataloged: string; published: string; pending: string };
  policy: { title: string; description: string; channel: string; latestVersion: string; minimumSupported: string; download: string; notes: string; noRelease: string; noPublicUrl: string; noNotes: string };
  publish: { title: string; description: string; version: string; channel: string; minimumSupported: string; minAppVersion: string; releaseNotes: string; releaseNotesPlaceholder: string; firmwareBin: string; selectBinHint: string; mandatory: string; mandatoryHint: string; activateOnPublish: string; activateHint: string; publishing: string; upload: string; clear: string };
  history: { title: string; description: string; empty: string; noVersion: string; active: string; historical: string; noNotes: string; activate: string; file: string; size: string; published: string };
  acl: { title: string; description: string; lastHealth: string; visibleFeatures: string; visibleActions: string; none: string };
}> = {
  es: {
    header: { eyebrow: "Configuración global", title: "Configuración del sistema", description: "Centro operativo global con runtime efectivo, catálogo ACL y publicación OTA completa para firmware BIN sin romper el contrato que ya consume la app móvil." },
    summaries: { environment: "Entorno", readiness: "Readiness", features: "Features", actions: "Acciones", ota: "OTA", yes: "sí", no: "no" },
    errors: { invalidSession: "Sesión inválida.", selectBin: "Seleccioná un BIN antes de publicar.", publishSuccess: (version) => `Release ${version} publicada correctamente.`, activateSuccess: (version) => `Rollback/publicación activada en ${version}.`, loadError: (message) => `No pude cargar una parte de la configuración efectiva: ${message}` },
    runtime: { runtime: "Runtime real", otaEditor: "Editor OTA", superadmin: "Superadmin", heroTitle: "Settings ahora puede publicar firmware BIN, sostener historial y reactivar releases sin tocar a mano el manifest que consume la app.", heroDescription: "El contrato legado se mantiene: la app sigue leyendo el mismo manifest OTA, pero ahora el backend puede resolverlo desde releases persistidas y el dashboard administra ese ciclo completo.", runtimeLabel: "Runtime", aclLabel: "ACL catalog", otaLabel: "OTA", noRelease: "sin release configurada" },
    context: { title: "Contexto efectivo actual", description: "Valores reales que hoy gobiernan el dashboard y el backend disponible.", appName: "Nombre de la app", apiBaseUrl: "API base URL", defaultRole: "Rol por defecto", currentSession: "Sesión actual", noEmail: "Sin email" },
    cards: { auth: "Autenticación y acceso", authDesc: (roles, permissions) => `${roles} roles y ${permissions} permisos efectivos en la sesión actual.`, sync: "Sincronización y operación", syncDesc: (readiness, degraded) => `Readiness ${readiness}, checks degradados ${degraded}.`, featureFlags: "Feature flags y comportamiento", featureFlagsDesc: (features, actions) => `${features} features y ${actions} acciones ACL visibles.`, ota: "Publicación OTA", otaDesc: (releases, channel) => `${releases} releases visibles y canal activo ${channel}.`, connected: "Conectado", empty: "Vacío", healthy: "Sano", review: "Revisar", cataloged: "Catalogado", published: "Publicado", pending: "Pendiente" },
    policy: { title: "Política OTA efectiva", description: "Lectura directa del manifest que ve hoy la app móvil.", channel: "Canal", latestVersion: "Versión latest", minimumSupported: "Mínima soportada", download: "Descarga", notes: "Notas", noRelease: "sin release", noPublicUrl: "sin URL pública", noNotes: "sin notas" },
    publish: { title: "Publicar release OTA", description: "Subí el BIN, calculá hash/tamaño server-side y dejá activa la release en el mismo flujo.", version: "Versión", channel: "Canal", minimumSupported: "Minimum supported version", minAppVersion: "Min app version", releaseNotes: "Notas de release", releaseNotesPlaceholder: "Resumen de cambios para admin/app.", firmwareBin: "Firmware BIN", selectBinHint: "Seleccioná el binario OTA que querés publicar.", mandatory: "Mandatory update", mandatoryHint: "Marca la release como obligatoria para el manifest.", activateOnPublish: "Activar al publicar", activateHint: "Si lo desmarcás, queda subida en historial pero no reemplaza la release activa.", publishing: "Publicando...", upload: "Subir y publicar OTA", clear: "Limpiar formulario" },
    history: { title: "Historial OTA y rollback", description: "Releases persistidas y fallback legacy visible cuando todavía viene desde env.", empty: "Todavía no hay releases OTA persistidas.", noVersion: "sin versión", active: "Activa", historical: "Histórica", noNotes: "Sin notas", activate: "Activar", file: "Archivo", size: "Tamaño", published: "Publicada" },
    acl: { title: "Catálogo ACL actual", description: "Primera lectura útil para entender qué parte del sistema ya está formalizada a nivel de permisos.", lastHealth: "Último health básico", visibleFeatures: "Features visibles", visibleActions: "Actions visibles", none: "ninguna" },
  },
  en: {
    header: { eyebrow: "Global settings", title: "System settings", description: "Global operations center with effective runtime, ACL catalog, and full OTA publishing for BIN firmware without breaking the contract already used by the mobile app." },
    summaries: { environment: "Environment", readiness: "Readiness", features: "Features", actions: "Actions", ota: "OTA", yes: "yes", no: "no" },
    errors: { invalidSession: "Invalid session.", selectBin: "Select a BIN before publishing.", publishSuccess: (version) => `Release ${version} published successfully.`, activateSuccess: (version) => `Rollback/publication activated on ${version}.`, loadError: (message) => `I couldn't load part of the effective configuration: ${message}` },
    runtime: { runtime: "Real runtime", otaEditor: "OTA editor", superadmin: "Superadmin", heroTitle: "Settings can now publish BIN firmware, keep history, and reactivate releases without manually touching the manifest consumed by the app.", heroDescription: "The legacy contract stays intact: the app still reads the same OTA manifest, but now the backend can resolve it from persisted releases and the dashboard manages that full cycle.", runtimeLabel: "Runtime", aclLabel: "ACL catalog", otaLabel: "OTA", noRelease: "no configured release" },
    context: { title: "Current effective context", description: "Real values currently governing the dashboard and the available backend.", appName: "App name", apiBaseUrl: "API base URL", defaultRole: "Default role", currentSession: "Current session", noEmail: "No email" },
    cards: { auth: "Authentication and access", authDesc: (roles, permissions) => `${roles} roles and ${permissions} effective permissions in the current session.`, sync: "Sync and operation", syncDesc: (readiness, degraded) => `Readiness ${readiness}, degraded checks ${degraded}.`, featureFlags: "Feature flags and behavior", featureFlagsDesc: (features, actions) => `${features} features and ${actions} visible ACL actions.`, ota: "OTA publishing", otaDesc: (releases, channel) => `${releases} visible releases and active channel ${channel}.`, connected: "Connected", empty: "Empty", healthy: "Healthy", review: "Review", cataloged: "Cataloged", published: "Published", pending: "Pending" },
    policy: { title: "Effective OTA policy", description: "Direct read of the manifest currently seen by the mobile app.", channel: "Channel", latestVersion: "Latest version", minimumSupported: "Minimum supported", download: "Download", notes: "Notes", noRelease: "no release", noPublicUrl: "no public URL", noNotes: "no notes" },
    publish: { title: "Publish OTA release", description: "Upload the BIN, calculate hash/size server-side, and leave the release active in the same flow.", version: "Version", channel: "Channel", minimumSupported: "Minimum supported version", minAppVersion: "Min app version", releaseNotes: "Release notes", releaseNotesPlaceholder: "Change summary for admin/app.", firmwareBin: "Firmware BIN", selectBinHint: "Select the OTA binary you want to publish.", mandatory: "Mandatory update", mandatoryHint: "Marks the release as mandatory for the manifest.", activateOnPublish: "Activate on publish", activateHint: "If unchecked, it stays in history but does not replace the active release.", publishing: "Publishing...", upload: "Upload and publish OTA", clear: "Clear form" },
    history: { title: "OTA history and rollback", description: "Persisted releases and visible legacy fallback when it still comes from env.", empty: "There are no persisted OTA releases yet.", noVersion: "no version", active: "Active", historical: "Historical", noNotes: "No notes", activate: "Activate", file: "File", size: "Size", published: "Published" },
    acl: { title: "Current ACL catalog", description: "First useful read to understand which part of the system is already formalized at the permissions level.", lastHealth: "Last basic health", visibleFeatures: "Visible features", visibleActions: "Visible actions", none: "none" },
  },
  pt: {
    header: { eyebrow: "Configuração global", title: "Configuração do sistema", description: "Centro operacional global com runtime efetivo, catálogo ACL e publicação OTA completa para firmware BIN sem quebrar o contrato que o app móvel já consome." },
    summaries: { environment: "Ambiente", readiness: "Readiness", features: "Features", actions: "Ações", ota: "OTA", yes: "sim", no: "não" },
    errors: { invalidSession: "Sessão inválida.", selectBin: "Selecione um BIN antes de publicar.", publishSuccess: (version) => `Release ${version} publicada com sucesso.`, activateSuccess: (version) => `Rollback/publicação ativada em ${version}.`, loadError: (message) => `Não consegui carregar parte da configuração efetiva: ${message}` },
    runtime: { runtime: "Runtime real", otaEditor: "Editor OTA", superadmin: "Superadmin", heroTitle: "Settings agora pode publicar firmware BIN, manter histórico e reativar releases sem mexer manualmente no manifest consumido pelo app.", heroDescription: "O contrato legado continua: o app segue lendo o mesmo manifest OTA, mas agora o backend pode resolvê-lo a partir de releases persistidas e o dashboard administra esse ciclo completo.", runtimeLabel: "Runtime", aclLabel: "ACL catalog", otaLabel: "OTA", noRelease: "sem release configurada" },
    context: { title: "Contexto efetivo atual", description: "Valores reais que hoje governam o dashboard e o backend disponível.", appName: "Nome do app", apiBaseUrl: "API base URL", defaultRole: "Papel padrão", currentSession: "Sessão atual", noEmail: "Sem email" },
    cards: { auth: "Autenticação e acesso", authDesc: (roles, permissions) => `${roles} papéis e ${permissions} permissões efetivas na sessão atual.`, sync: "Sincronização e operação", syncDesc: (readiness, degraded) => `Readiness ${readiness}, checks degradados ${degraded}.`, featureFlags: "Feature flags e comportamento", featureFlagsDesc: (features, actions) => `${features} features e ${actions} ações ACL visíveis.`, ota: "Publicação OTA", otaDesc: (releases, channel) => `${releases} releases visíveis e canal ativo ${channel}.`, connected: "Conectado", empty: "Vazio", healthy: "Saudável", review: "Revisar", cataloged: "Catalogado", published: "Publicado", pending: "Pendente" },
    policy: { title: "Política OTA efetiva", description: "Leitura direta do manifest que o app móvel vê hoje.", channel: "Canal", latestVersion: "Versão latest", minimumSupported: "Mínima suportada", download: "Download", notes: "Notas", noRelease: "sem release", noPublicUrl: "sem URL pública", noNotes: "sem notas" },
    publish: { title: "Publicar release OTA", description: "Envie o BIN, calcule hash/tamanho no servidor e deixe a release ativa no mesmo fluxo.", version: "Versão", channel: "Canal", minimumSupported: "Minimum supported version", minAppVersion: "Min app version", releaseNotes: "Notas da release", releaseNotesPlaceholder: "Resumo de mudanças para admin/app.", firmwareBin: "Firmware BIN", selectBinHint: "Selecione o binário OTA que deseja publicar.", mandatory: "Mandatory update", mandatoryHint: "Marca a release como obrigatória para o manifest.", activateOnPublish: "Ativar ao publicar", activateHint: "Se desmarcar, ela fica no histórico mas não substitui a release ativa.", publishing: "Publicando...", upload: "Enviar e publicar OTA", clear: "Limpar formulário" },
    history: { title: "Histórico OTA e rollback", description: "Releases persistidas e fallback legacy visível quando ainda vem do env.", empty: "Ainda não há releases OTA persistidas.", noVersion: "sem versão", active: "Ativa", historical: "Histórica", noNotes: "Sem notas", activate: "Ativar", file: "Arquivo", size: "Tamanho", published: "Publicada" },
    acl: { title: "Catálogo ACL atual", description: "Primeira leitura útil para entender qual parte do sistema já está formalizada no nível de permissões.", lastHealth: "Último health básico", visibleFeatures: "Features visíveis", visibleActions: "Actions visíveis", none: "nenhuma" },
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

type FeedbackState = { type: "success" | "error"; message: string } | null;

type OtaFormState = {
  version: string;
  channel: string;
  minimumSupportedVersion: string;
  minAppVersion: string;
  notes: string;
  mandatory: boolean;
  activate: boolean;
  file: File | null;
};

const INITIAL_FORM: OtaFormState = {
  version: "",
  channel: "stable",
  minimumSupportedVersion: "",
  minAppVersion: "",
  notes: "",
  mandatory: false,
  activate: true,
  file: null,
};

function formatBytes(value?: number | null) {
  if (!value || Number.isNaN(value)) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function sourceLabel(release: OtaReleaseRecord) {
  return release.sourceType === "env" ? "legacy/env" : "dashboard";
}

export function SystemSettingsCenter() {
  const { language } = useLanguage();
  const t = settingsMessages[language];
  const { user, tokens } = useAuth();
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [form, setForm] = useState<OtaFormState>(INITIAL_FORM);

  const healthQuery = useBasicHealth();
  const readinessQuery = useReadinessHealth();
  const otaQuery = useOtaRelease(tokens?.accessToken);
  const otaReleasesQuery = useOtaReleases(tokens?.accessToken);
  const featuresQuery = useAccessFeatures(tokens?.accessToken);
  const actionsQuery = useAccessActions(tokens?.accessToken);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!tokens?.accessToken) throw new Error(t.errors.invalidSession);
      if (!form.file) throw new Error(t.errors.selectBin);
      return createOtaRelease(tokens.accessToken, {
        file: form.file,
        version: form.version,
        channel: form.channel,
        minimumSupportedVersion: form.minimumSupportedVersion || undefined,
        minAppVersion: form.minAppVersion || undefined,
        notes: form.notes || undefined,
        mandatory: form.mandatory,
        activate: form.activate,
      });
    },
    onSuccess: async (release) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "ota-release"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "ota-releases"] }),
      ]);
      setForm({ ...INITIAL_FORM, channel: release.channel || "stable" });
      setFeedback({ type: "success", message: t.errors.publishSuccess(release.latestVersion || "OTA") });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const activateMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      if (!tokens?.accessToken) throw new Error(t.errors.invalidSession);
      return activateOtaRelease(tokens.accessToken, releaseId);
    },
    onSuccess: async (release) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "ota-release"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "ota-releases"] }),
      ]);
      setFeedback({ type: "success", message: t.errors.activateSuccess(release.latestVersion || "release OTA") });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const isLoading =
    healthQuery.isLoading ||
    readinessQuery.isLoading ||
    otaQuery.isLoading ||
    otaReleasesQuery.isLoading ||
    featuresQuery.isLoading ||
    actionsQuery.isLoading;
  const error =
    healthQuery.error ||
    readinessQuery.error ||
    otaQuery.error ||
    otaReleasesQuery.error ||
    featuresQuery.error ||
    actionsQuery.error;

  const releases = otaReleasesQuery.data?.data || [];

  const releasesPagination = useListPagination(releases);

  const metrics = useMemo(() => {
    const features = featuresQuery.data?.data || [];
    const actions = actionsQuery.data?.data || [];
    const degradedChecks = Object.values(readinessQuery.data?.checks || {}).filter((check) => check?.status !== "healthy").length;

    return {
      environment: healthQuery.data?.environment || "-",
      version: healthQuery.data?.version || "-",
      readiness: readinessQuery.data?.status || "unknown",
      degradedChecks,
      featureCount: featuresQuery.data?.total || features.length,
      actionCount: actionsQuery.data?.total || actions.length,
      otaConfigured: otaQuery.data?.configured ? t.summaries.yes : t.summaries.no,
      otaChannel: otaQuery.data?.channel || "-",
      otaReleases: otaReleasesQuery.data?.total || releases.length,
      permissionCount: user?.permissions.length || 0,
      roleCount: user?.roles.length || 0,
      features,
      actions,
    };
  }, [
    actionsQuery.data,
    featuresQuery.data,
    healthQuery.data,
    otaQuery.data,
    otaReleasesQuery.data,
    readinessQuery.data,
    releases.length,
    user?.permissions.length,
    user?.roles.length,
  ]);

  const configurationTracks = [
    {
      title: t.cards.auth,
      description: t.cards.authDesc(metrics.roleCount, metrics.permissionCount),
      status: user?.roles.length ? t.cards.connected : t.cards.empty,
      icon: LockKeyhole,
    },
    {
      title: t.cards.sync,
      description: t.cards.syncDesc(metrics.readiness, metrics.degradedChecks),
      status: metrics.degradedChecks === 0 ? t.cards.healthy : t.cards.review,
      icon: RadioTower,
    },
    {
      title: t.cards.featureFlags,
      description: t.cards.featureFlagsDesc(metrics.featureCount, metrics.actionCount),
      status: metrics.featureCount > 0 ? t.cards.cataloged : t.cards.empty,
      icon: SlidersHorizontal,
    },
    {
      title: t.cards.ota,
      description: t.cards.otaDesc(metrics.otaReleases, metrics.otaChannel),
      status: metrics.otaConfigured === t.summaries.yes ? t.cards.published : t.cards.pending,
      icon: ShieldCheck,
    },
  ];

  const isSaving = uploadMutation.isPending || activateMutation.isPending;

  function updateForm<K extends keyof OtaFormState>(key: K, value: OtaFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    uploadMutation.mutate();
  }

  return (
    <div className="space-y-6">
        <SectionHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title}
        description={t.header.description}
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={t.summaries.environment} value={metrics.environment} icon={Settings} />
            <SummaryCard label={t.summaries.readiness} value={metrics.readiness} icon={RadioTower} />
            <SummaryCard label={t.summaries.features} value={String(metrics.featureCount)} icon={SlidersHorizontal} />
            <SummaryCard label={t.summaries.actions} value={String(metrics.actionCount)} icon={ShieldCheck} />
            <SummaryCard label={t.summaries.ota} value={metrics.otaConfigured} icon={LockKeyhole} />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            {t.errors.loadError(getErrorMessage(error))}
          </CardContent>
        </Card>
      ) : null}

      {feedback ? (
        <Card className={feedback.type === "success" ? "border-emerald-200 bg-emerald-50/70" : "border-destructive/20 bg-white/85"}>
          <CardContent className={feedback.type === "success" ? "p-4 text-sm text-emerald-700" : "p-4 text-sm text-destructive"}>
            {feedback.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">{t.runtime.runtime}</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">{t.runtime.otaEditor}</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">{t.runtime.superadmin}</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t.runtime.heroTitle}
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                {t.runtime.heroDescription}
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">{t.runtime.runtimeLabel}</p>
                <p className="mt-2 text-lg font-medium">{metrics.environment} · backend {metrics.version}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">{t.runtime.aclLabel}</p>
                <p className="mt-2 text-lg font-medium">{metrics.featureCount} features y {metrics.actionCount} acciones visibles</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">{t.runtime.otaLabel}</p>
                <p className="mt-2 text-lg font-medium">{otaQuery.data?.latestVersion ? `${otaQuery.data.latestVersion} · ${otaQuery.data.channel || "stable"}` : t.runtime.noRelease}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.context.title}</CardTitle>
            <CardDescription>{t.context.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.context.appName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.appName}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.context.apiBaseUrl}</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{appConfig.apiBaseUrl}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.context.defaultRole}</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.defaultRole}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.context.currentSession}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || t.context.noEmail}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {configurationTracks.map((track) => {
          const Icon = track.icon;
          return (
            <Card key={track.title} className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-primary/12 p-3 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <Badge variant="secondary">{track.status}</Badge>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{track.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{track.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.policy.title}</CardTitle>
            <CardDescription>{t.policy.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.policy.channel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.channel || "-"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.policy.latestVersion}</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.latestVersion || t.policy.noRelease}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.policy.minimumSupported}</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.minimumSupportedVersion || "-"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.policy.download}</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{otaQuery.data?.downloadUrl || t.policy.noPublicUrl}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">{t.policy.notes}</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.notes || t.policy.noNotes}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="size-5 text-primary" />
              <CardTitle>{t.publish.title}</CardTitle>
            </div>
            <CardDescription>{t.publish.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ota-version">{t.publish.version}</Label>
                  <Input id="ota-version" value={form.version} onChange={(event) => updateForm("version", event.target.value)} placeholder="V0.16" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-channel">{t.publish.channel}</Label>
                  <Input id="ota-channel" value={form.channel} onChange={(event) => updateForm("channel", event.target.value)} placeholder="stable" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-min-supported">{t.publish.minimumSupported}</Label>
                  <Input
                    id="ota-min-supported"
                    value={form.minimumSupportedVersion}
                    onChange={(event) => updateForm("minimumSupportedVersion", event.target.value)}
                    placeholder="V0.14"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-min-app">{t.publish.minAppVersion}</Label>
                  <Input id="ota-min-app" value={form.minAppVersion} onChange={(event) => updateForm("minAppVersion", event.target.value)} placeholder="1.0.0" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ota-notes">{t.publish.releaseNotes}</Label>
                <textarea
                  id="ota-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder={t.publish.releaseNotesPlaceholder}
                  className="min-h-28 w-full rounded-3xl border border-input bg-white/92 px-4 py-3 text-sm text-foreground shadow-[0_10px_24px_rgba(66,128,164,0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ota-file">{t.publish.firmwareBin}</Label>
                <Input
                  id="ota-file"
                  type="file"
                  accept=".bin,application/octet-stream"
                  onChange={(event) => updateForm("file", event.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  {form.file ? `${form.file.name} · ${formatBytes(form.file.size)}` : t.publish.selectBinHint}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/75 p-4 text-sm text-muted-foreground">
                  <input type="checkbox" checked={form.mandatory} onChange={(event) => updateForm("mandatory", event.target.checked)} className="mt-1 size-4" />
                  <span>
                    <span className="block font-medium text-foreground">{t.publish.mandatory}</span>
                    {t.publish.mandatoryHint}
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/75 p-4 text-sm text-muted-foreground">
                  <input type="checkbox" checked={form.activate} onChange={(event) => updateForm("activate", event.target.checked)} className="mt-1 size-4" />
                  <span>
                    <span className="block font-medium text-foreground">{t.publish.activateOnPublish}</span>
                    {t.publish.activateHint}
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving || !form.version.trim() || !form.file}>
                  <Upload className="size-4" />
                  {uploadMutation.isPending ? t.publish.publishing : t.publish.upload}
                </Button>
                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setForm(INITIAL_FORM)}>
                  {t.publish.clear}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <History className="size-5 text-primary" />
                  <CardTitle>{t.history.title}</CardTitle>
                </div>
                <CardDescription>{t.history.description}</CardDescription>
              </div>
              <ListPaginationControls
                pageSize={releasesPagination.pageSize}
                setPageSize={releasesPagination.setPageSize}
                currentPage={releasesPagination.currentPage}
                totalPages={releasesPagination.totalPages}
                totalItems={releasesPagination.totalItems}
                paginationStart={releasesPagination.paginationStart}
                paginationEnd={releasesPagination.paginationEnd}
                goToPreviousPage={releasesPagination.goToPreviousPage}
                goToNextPage={releasesPagination.goToNextPage}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {releases.length === 0 ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">{t.history.empty}</div>
            ) : (
              releasesPagination.paginatedItems.map((release) => {
                const canActivate = Boolean(release.id) && !release.isActive && release.sourceType !== "env";
                return (
                  <div key={release.id || `${release.channel}-${release.latestVersion}`} className="rounded-3xl border border-border/70 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{release.latestVersion || t.history.noVersion}</p>
                          <Badge variant={release.isActive ? "success" : "outline"}>{release.isActive ? t.history.active : t.history.historical}</Badge>
                          <Badge variant="secondary">{release.channel || "stable"}</Badge>
                          <Badge variant="outline">{sourceLabel(release)}</Badge>
                          {release.mandatory ? <Badge variant="warning">mandatory</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {release.notes || t.history.noNotes}
                        </p>
                      </div>
                      {canActivate ? (
                        <Button type="button" variant="outline" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate(release.id as string)}>
                          <RotateCcw className="size-4" />
                          {t.history.activate}
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.history.file}</p>
                        <p className="mt-1 text-sm text-foreground">{release.originalFilename || release.filename || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.history.size}</p>
                        <p className="mt-1 text-sm text-foreground">{formatBytes(release.sizeBytes)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SHA256</p>
                        <p className="mt-1 break-all text-sm text-foreground">{release.sha256 || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Minimum supported</p>
                        <p className="mt-1 text-sm text-foreground">{release.minimumSupportedVersion || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Min app version</p>
                        <p className="mt-1 text-sm text-foreground">{release.minAppVersion || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.history.published}</p>
                        <p className="mt-1 text-sm text-foreground">{formatDateTime(release.publishedAt || release.createdAt) || "-"}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-primary" />
              <CardTitle>{t.acl.title}</CardTitle>
            </div>
            <CardDescription>{t.acl.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {t.acl.lastHealth}: <strong>{formatDateTime(healthQuery.data?.timestamp)}</strong>.
            </div>
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {t.acl.visibleFeatures}: <strong>{metrics.features.map((feature) => feature.code).join(", ") || t.acl.none}</strong>.
            </div>
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              {t.acl.visibleActions}: <strong>{metrics.actions.map((action) => action.code).join(", ") || t.acl.none}</strong>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
