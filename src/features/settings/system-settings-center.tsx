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
import { activateOtaRelease, createOtaRelease, useOtaRelease, useOtaReleases } from "@/features/settings/api";
import type { OtaReleaseRecord } from "@/features/settings/types";
import { appConfig } from "@/lib/api/config";
import { formatDateTime, getErrorMessage } from "@/lib/utils";

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
      if (!tokens?.accessToken) throw new Error("Sesión inválida.");
      if (!form.file) throw new Error("Seleccioná un BIN antes de publicar.");
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
      setFeedback({ type: "success", message: `Release ${release.latestVersion || "OTA"} publicada correctamente.` });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const activateMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      if (!tokens?.accessToken) throw new Error("Sesión inválida.");
      return activateOtaRelease(tokens.accessToken, releaseId);
    },
    onSuccess: async (release) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "ota-release"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "ota-releases"] }),
      ]);
      setFeedback({ type: "success", message: `Rollback/publicación activada en ${release.latestVersion || "release OTA"}.` });
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
      otaConfigured: otaQuery.data?.configured ? "sí" : "no",
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
      title: "Autenticación y acceso",
      description: `${metrics.roleCount} roles y ${metrics.permissionCount} permisos efectivos en la sesión actual.`,
      status: user?.roles.length ? "Conectado" : "Vacío",
      icon: LockKeyhole,
    },
    {
      title: "Sincronización y operación",
      description: `Readiness ${metrics.readiness}, checks degradados ${metrics.degradedChecks}.`,
      status: metrics.degradedChecks === 0 ? "Sano" : "Revisar",
      icon: RadioTower,
    },
    {
      title: "Feature flags y comportamiento",
      description: `${metrics.featureCount} features y ${metrics.actionCount} acciones ACL visibles.`,
      status: metrics.featureCount > 0 ? "Catalogado" : "Vacío",
      icon: SlidersHorizontal,
    },
    {
      title: "Publicación OTA",
      description: `${metrics.otaReleases} releases visibles y canal activo ${metrics.otaChannel}.`,
      status: metrics.otaConfigured === "sí" ? "Publicado" : "Pendiente",
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
        eyebrow="Configuración global"
        title="Configuración del sistema"
        description="Centro operativo global con runtime efectivo, catálogo ACL y publicación OTA completa para firmware BIN sin romper el contrato que ya consume la app móvil."
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Entorno" value={metrics.environment} icon={Settings} />
            <SummaryCard label="Readiness" value={metrics.readiness} icon={RadioTower} />
            <SummaryCard label="Features" value={String(metrics.featureCount)} icon={SlidersHorizontal} />
            <SummaryCard label="Acciones" value={String(metrics.actionCount)} icon={ShieldCheck} />
            <SummaryCard label="OTA" value={metrics.otaConfigured} icon={LockKeyhole} />
          </>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/20 bg-white/85">
          <CardContent className="p-6 text-sm text-destructive">
            No pude cargar una parte de la configuración efectiva: {getErrorMessage(error)}
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
              <Badge className="bg-white/14 text-white hover:bg-white/14">Runtime real</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Editor OTA</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Superadmin</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Settings ahora puede publicar firmware BIN, sostener historial y reactivar releases sin tocar a mano el manifest que consume la app.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                El contrato legado se mantiene: la app sigue leyendo el mismo manifest OTA, pero ahora el backend puede resolverlo desde releases persistidas y el dashboard administra ese ciclo completo.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">Runtime</p>
                <p className="mt-2 text-lg font-medium">{metrics.environment} · backend {metrics.version}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">ACL catalog</p>
                <p className="mt-2 text-lg font-medium">{metrics.featureCount} features y {metrics.actionCount} acciones visibles</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-white/70">OTA</p>
                <p className="mt-2 text-lg font-medium">{otaQuery.data?.latestVersion ? `${otaQuery.data.latestVersion} · ${otaQuery.data.channel || "stable"}` : "sin release configurada"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Contexto efectivo actual</CardTitle>
            <CardDescription>Valores reales que hoy gobiernan el dashboard y el backend disponible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Nombre de la app</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.appName}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">API base URL</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{appConfig.apiBaseUrl}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Rol por defecto</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.defaultRole}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Sesión actual</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || "Sin email"}</p>
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
            <CardTitle>Política OTA efectiva</CardTitle>
            <CardDescription>Lectura directa del manifest que ve hoy la app móvil.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Canal</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.channel || "-"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Versión latest</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.latestVersion || "sin release"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Mínima soportada</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.minimumSupportedVersion || "-"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Descarga</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{otaQuery.data?.downloadUrl || "sin URL pública"}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Notas</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.notes || "sin notas"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="size-5 text-primary" />
              <CardTitle>Publicar release OTA</CardTitle>
            </div>
            <CardDescription>Subí el BIN, calculá hash/tamaño server-side y dejá activa la release en el mismo flujo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ota-version">Versión</Label>
                  <Input id="ota-version" value={form.version} onChange={(event) => updateForm("version", event.target.value)} placeholder="V0.16" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-channel">Canal</Label>
                  <Input id="ota-channel" value={form.channel} onChange={(event) => updateForm("channel", event.target.value)} placeholder="stable" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-min-supported">Minimum supported version</Label>
                  <Input
                    id="ota-min-supported"
                    value={form.minimumSupportedVersion}
                    onChange={(event) => updateForm("minimumSupportedVersion", event.target.value)}
                    placeholder="V0.14"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ota-min-app">Min app version</Label>
                  <Input id="ota-min-app" value={form.minAppVersion} onChange={(event) => updateForm("minAppVersion", event.target.value)} placeholder="1.0.0" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ota-notes">Notas de release</Label>
                <textarea
                  id="ota-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Resumen de cambios para admin/app."
                  className="min-h-28 w-full rounded-3xl border border-input bg-white/92 px-4 py-3 text-sm text-foreground shadow-[0_10px_24px_rgba(66,128,164,0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ota-file">Firmware BIN</Label>
                <Input
                  id="ota-file"
                  type="file"
                  accept=".bin,application/octet-stream"
                  onChange={(event) => updateForm("file", event.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  {form.file ? `${form.file.name} · ${formatBytes(form.file.size)}` : "Seleccioná el binario OTA que querés publicar."}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/75 p-4 text-sm text-muted-foreground">
                  <input type="checkbox" checked={form.mandatory} onChange={(event) => updateForm("mandatory", event.target.checked)} className="mt-1 size-4" />
                  <span>
                    <span className="block font-medium text-foreground">Mandatory update</span>
                    Marca la release como obligatoria para el manifest.
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/75 p-4 text-sm text-muted-foreground">
                  <input type="checkbox" checked={form.activate} onChange={(event) => updateForm("activate", event.target.checked)} className="mt-1 size-4" />
                  <span>
                    <span className="block font-medium text-foreground">Activar al publicar</span>
                    Si lo desmarcás, queda subida en historial pero no reemplaza la release activa.
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving || !form.version.trim() || !form.file}>
                  <Upload className="size-4" />
                  {uploadMutation.isPending ? "Publicando..." : "Subir y publicar OTA"}
                </Button>
                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setForm(INITIAL_FORM)}>
                  Limpiar formulario
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
                  <CardTitle>Historial OTA y rollback</CardTitle>
                </div>
                <CardDescription>Releases persistidas y fallback legacy visible cuando todavía viene desde env.</CardDescription>
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
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">Todavía no hay releases OTA persistidas.</div>
            ) : (
              releasesPagination.paginatedItems.map((release) => {
                const canActivate = Boolean(release.id) && !release.isActive && release.sourceType !== "env";
                return (
                  <div key={release.id || `${release.channel}-${release.latestVersion}`} className="rounded-3xl border border-border/70 bg-white/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{release.latestVersion || "sin versión"}</p>
                          <Badge variant={release.isActive ? "success" : "outline"}>{release.isActive ? "Activa" : "Histórica"}</Badge>
                          <Badge variant="secondary">{release.channel || "stable"}</Badge>
                          <Badge variant="outline">{sourceLabel(release)}</Badge>
                          {release.mandatory ? <Badge variant="warning">mandatory</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {release.notes || "Sin notas"}
                        </p>
                      </div>
                      {canActivate ? (
                        <Button type="button" variant="outline" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate(release.id as string)}>
                          <RotateCcw className="size-4" />
                          Activar
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archivo</p>
                        <p className="mt-1 text-sm text-foreground">{release.originalFilename || release.filename || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tamaño</p>
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Publicada</p>
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
              <CardTitle>Catálogo ACL actual</CardTitle>
            </div>
            <CardDescription>Primera lectura útil para entender qué parte del sistema ya está formalizada a nivel de permisos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              Último health básico: <strong>{formatDateTime(healthQuery.data?.timestamp)}</strong>.
            </div>
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              Features visibles: <strong>{metrics.features.map((feature) => feature.code).join(", ") || "ninguna"}</strong>.
            </div>
            <div className="rounded-2xl bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              Actions visibles: <strong>{metrics.actions.map((action) => action.code).join(", ") || "ninguna"}</strong>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
