"use client";

import { type ComponentType, useMemo } from "react";
import { LockKeyhole, RadioTower, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccessActions, useAccessFeatures } from "@/features/access-control/api";
import { useAuth } from "@/features/auth/auth-context";
import { useBasicHealth, useReadinessHealth } from "@/features/health/api";
import { useOtaRelease } from "@/features/settings/api";
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
  hint: string;
  icon: ComponentType<{ className?: string }>;
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

export function SystemSettingsCenter() {
  const { user, tokens } = useAuth();
  const healthQuery = useBasicHealth();
  const readinessQuery = useReadinessHealth();
  const otaQuery = useOtaRelease(tokens?.accessToken);
  const featuresQuery = useAccessFeatures(tokens?.accessToken);
  const actionsQuery = useAccessActions(tokens?.accessToken);

  const isLoading = healthQuery.isLoading || readinessQuery.isLoading || otaQuery.isLoading || featuresQuery.isLoading || actionsQuery.isLoading;
  const error = healthQuery.error || readinessQuery.error || otaQuery.error || featuresQuery.error || actionsQuery.error;

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
      permissionCount: user?.permissions.length || 0,
      roleCount: user?.roles.length || 0,
      features,
      actions,
    };
  }, [actionsQuery.data, featuresQuery.data, healthQuery.data, otaQuery.data, readinessQuery.data, user?.permissions.length, user?.roles.length]);

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
      title: "Seguridad y gobernanza",
      description: `Entorno ${metrics.environment}, versión ${metrics.version}, OTA ${metrics.otaConfigured}.`,
      status: "Visible",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Configuración global"
        title="Settings"
        description="Centro read-only de configuración efectiva: runtime real del backend, contexto de sesión, catálogos ACL y política OTA actual."
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Alcance operativo</p>
              <Badge variant="secondary">admin global</Badge>
              <Badge variant="outline">runtime efectivo</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta pantalla resume configuración global y catálogos efectivos del backend. No funciona como una vista institucional scopeada, aunque la sesión actual sea {user?.email || "global"}.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Entorno" value={metrics.environment} hint={`Backend ${metrics.version}.`} icon={Settings} />
            <SummaryCard label="Readiness" value={metrics.readiness} hint={`Checks degradados: ${metrics.degradedChecks}.`} icon={RadioTower} />
            <SummaryCard label="Features" value={String(metrics.featureCount)} hint="Catálogo real de features ACL." icon={SlidersHorizontal} />
            <SummaryCard label="Acciones" value={String(metrics.actionCount)} hint="Acciones reales disponibles para permisos." icon={ShieldCheck} />
            <SummaryCard label="OTA" value={metrics.otaConfigured} hint={`Canal ${metrics.otaChannel}.`} icon={LockKeyhole} />
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr]">
        <Card className="overflow-hidden border-none bg-[linear-gradient(135deg,#1f2a37_0%,#2c4156_55%,#39546f_100%)] text-white shadow-[0_20px_60px_rgba(31,42,55,0.22)]">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/14 text-white hover:bg-white/14">Runtime real</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Read-only</Badge>
              <Badge className="bg-white/14 text-white hover:bg-white/14">Superadmin</Badge>
            </div>

            <div className="mt-6 max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Settings dejó de ser una promesa de UX y pasó a explicar cómo está corriendo el sistema hoy.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/78">
                Esta iteración muestra configuración efectiva y catálogos reales del backend, sin inventar aún un editor persistente donde el contrato no existe.
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
                <p className="mt-2 text-lg font-medium">{metrics.otaConfigured === "sí" ? `canal ${metrics.otaChannel}` : "sin release configurada"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Contexto efectivo actual</CardTitle>
            <CardDescription>
              Valores reales que hoy gobiernan el dashboard y el backend disponible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">App name</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.appName}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">API base URL</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">{appConfig.apiBaseUrl}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Default role fallback</p>
              <p className="mt-1 text-sm text-muted-foreground">{appConfig.defaultRole}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-medium text-foreground">Sesión actual</p>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email || "Sin email"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Política OTA actual</CardTitle>
            <CardDescription>
              Lectura directa de la release móvil publicada por el backend.
            </CardDescription>
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
              <p className="text-sm font-medium text-foreground">Notas</p>
              <p className="mt-1 text-sm text-muted-foreground">{otaQuery.data?.notes || "sin notas"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-primary" />
              <CardTitle>Catálogo ACL actual</CardTitle>
            </div>
            <CardDescription>
              Primera lectura útil para entender qué parte del sistema ya está formalizada a nivel de permisos.
            </CardDescription>
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
