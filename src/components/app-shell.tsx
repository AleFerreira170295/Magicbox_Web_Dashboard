"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  Cable,
  ChevronRight,
  Database,
  KeyRound,
  LogOut,
  Settings,
  ShieldAlert,
  Sparkles,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { canAccessPermissionsModule } from "@/features/auth/permission-contract";
import type { AppRole } from "@/features/auth/types";
import { completeTutorial, hasCompletedTutorial } from "@/features/tutorial/storage";
import { WebOnboardingTour } from "@/features/tutorial/web-onboarding-tour";
import { appConfig } from "@/lib/api/config";
import { cn } from "@/lib/utils";

type NavigationRole = AppRole;
type NavigationSection = "Resumen" | "Operación" | "Gobernanza" | "Técnico";

type NavigationItem = {
  href: string;
  label: string;
  summary: string;
  section: NavigationSection;
  icon: React.ComponentType<{ className?: string }>;
  roles: NavigationRole[];
  isVisible?: (user: { roles?: string[]; permissions?: string[] } | null | undefined) => boolean;
};

const navigationSections: NavigationSection[] = ["Resumen", "Operación", "Gobernanza", "Técnico"];

function formatRoleLabel(role: string) {
  switch (role) {
    case "teacher":
      return "docente";
    case "director":
      return "director";
    case "researcher":
      return "researcher";
    case "family":
      return "familia";
    case "institution-admin":
      return "institution admin";
    case "government-viewer":
      return "gobierno";
    case "admin":
      return "admin";
    default:
      return role;
  }
}

function getExperienceMeta(user: { roles?: string[]; permissions?: string[] } | null | undefined) {
  if (user?.roles?.includes("government-viewer")) {
    return {
      title: "Vista gobierno",
      description:
        "Seguimiento territorial, alertas ejecutivas y lectura agregada sin mezclar capas técnicas que no aportan a este perfil.",
    };
  }

  if (user?.roles?.includes("researcher")) {
    return {
      title: "Vista investigación",
      description:
        "Evidencia capturada, consistencia entre sync y partida, y lectura de muestra con menos ruido técnico.",
    };
  }

  if (user?.roles?.includes("family")) {
    return {
      title: "Vista familia",
      description:
        "Seguimiento simple y claro de la actividad, sin fricción técnica ni administrativa.",
    };
  }

  if (user?.roles?.includes("teacher")) {
    return {
      title: "Vista docente",
      description:
        "Juego, dispositivos y sincronizaciones a mano para operar el aula con rapidez.",
    };
  }

  if (user?.roles?.includes("institution-admin") || user?.roles?.includes("director")) {
    return {
      title: "Vista institucional",
      description:
        "Seguimiento institucional, gobernanza cotidiana y foco en lo que requiere acción hoy.",
    };
  }

  if (user?.roles?.includes("admin")) {
    return {
      title: "Vista plataforma",
      description:
        "Visión global, módulos técnicos y superficies transversales para operar toda la plataforma.",
    };
  }

  return {
    title: "Vista institucional",
    description: "Seguimiento pedagógico claro, cálido y accionable.",
  };
}

const navigation: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    summary: "Estado general, alertas y próximos focos del rol actual.",
    section: "Resumen",
    icon: BarChart3,
    roles: ["teacher", "director", "researcher", "family", "admin", "institution-admin", "government-viewer"] satisfies NavigationRole[],
  },
  {
    href: "/territorial-alerts",
    label: "Alertas territoriales",
    summary: "Incidentes y territorios que necesitan revisión rápida.",
    section: "Resumen",
    icon: ShieldAlert,
    roles: ["government-viewer"] satisfies NavigationRole[],
  },
  {
    href: "/territorial-overview",
    label: "Territorios e instituciones",
    summary: "Drilldown territorial con foco en cohortes e instituciones.",
    section: "Resumen",
    icon: Building2,
    roles: ["government-viewer"] satisfies NavigationRole[],
  },
  {
    href: "/devices",
    label: "Dispositivos",
    summary: "Parque, ownership y estado de los dispositivos.",
    section: "Operación",
    icon: Smartphone,
    roles: ["teacher", "director", "admin", "institution-admin", "family"] satisfies NavigationRole[],
  },
  {
    href: "/games",
    label: "Partidas",
    summary: "Sesiones, jugadores, turnos y uso reciente con contexto real.",
    section: "Operación",
    icon: Database,
    roles: ["teacher", "director", "researcher", "family", "admin", "institution-admin"] satisfies NavigationRole[],
  },
  {
    href: "/syncs",
    label: "Sincronizaciones",
    summary: "Trazabilidad reciente, captura y consistencia de sincronizaciones.",
    section: "Operación",
    icon: Cable,
    roles: ["teacher", "director", "researcher", "family", "admin", "institution-admin"] satisfies NavigationRole[],
  },
  {
    href: "/users",
    label: "Usuarios",
    summary: "Padrón, roles y contexto de usuarios.",
    section: "Gobernanza",
    icon: Users,
    roles: ["admin", "institution-admin", "family"] satisfies NavigationRole[],
  },
  {
    href: "/institutions",
    label: "Instituciones",
    summary: "Seguimiento institucional con foco en observaciones y cobertura.",
    section: "Gobernanza",
    icon: Building2,
    roles: ["admin", "institution-admin", "director"] satisfies NavigationRole[],
  },
  {
    href: "/profiles",
    label: "Perfiles",
    summary: "Bindings, sesiones y trazabilidad entre personas y uso.",
    section: "Gobernanza",
    icon: UserRound,
    roles: ["admin", "institution-admin", "director"] satisfies NavigationRole[],
  },
  {
    href: "/permissions",
    label: "Permisos",
    summary: "Contrato ACL, bundles y consistencia de permisos efectivos.",
    section: "Gobernanza",
    icon: KeyRound,
    roles: ["admin", "institution-admin"] satisfies NavigationRole[],
    isVisible: (user) => canAccessPermissionsModule(user),
  },
  {
    href: "/health",
    label: "Salud",
    summary: "Checks técnicos, readiness y señales del backend real.",
    section: "Técnico",
    icon: Activity,
    roles: ["admin"] satisfies NavigationRole[],
  },
  {
    href: "/settings",
    label: "Configuración",
    summary: "Runtime efectivo, catálogos y configuración del sistema.",
    section: "Técnico",
    icon: Settings,
    roles: ["admin"] satisfies NavigationRole[],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const experienceMeta = getExperienceMeta(user);
  const hasTutorialPending = Boolean(user?.id && !hasCompletedTutorial(user.id));
  const tutorialVisible = isTutorialOpen;

  const visibleNavigation = useMemo(
    () =>
      navigation.filter((item) => {
        const allowedByRole = item.roles.some((role) => user?.roles.includes(role));
        if (!allowedByRole) return false;
        return item.isVisible ? item.isVisible(user) : true;
      }),
    [user],
  );

  const groupedNavigation = useMemo(
    () =>
      navigationSections
        .map((section) => ({
          section,
          items: visibleNavigation.filter((item) => item.section === section),
        }))
        .filter((group) => group.items.length > 0),
    [visibleNavigation],
  );

  const currentItem = useMemo(
    () => visibleNavigation.find((item) => item.href === pathname) ?? visibleNavigation[0] ?? null,
    [pathname, visibleNavigation],
  );

  function finishTutorial() {
    if (user?.id) {
      completeTutorial(user.id);
    }
    setIsTutorialOpen(false);
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {tutorialVisible ? <WebOnboardingTour user={user} onSkip={finishTutorial} onComplete={finishTutorial} /> : null}

        <div className="grid min-h-screen xl:grid-cols-[clamp(248px,22vw,320px)_minmax(0,1fr)]">
          <aside className="hidden border-r border-border/70 bg-white/92 text-sidebar-foreground xl:block">
            <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-5 py-5">
              <div className="rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,253,0.95))] px-5 py-6 shadow-[0_18px_44px_rgba(33,59,87,0.08)]">
                <div className="flex items-start gap-4">
                  <BrandLogo variant="icon" className="w-14 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">MagicBox</p>
                    <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">Web Dashboard</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Navegación desktop más clara para recorrer rápido cada superficie.</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-border/80 bg-secondary/45 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    {experienceMeta.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{experienceMeta.description}</p>
                </div>

                {hasTutorialPending ? (
                  <div className="mt-4 rounded-[22px] border border-primary/14 bg-primary/7 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Recorrido guiado disponible</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Lo dejé fuera del arranque para no tapar la pantalla.</p>
                      </div>
                      <Badge>Nuevo</Badge>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-4 w-full" onClick={() => setIsTutorialOpen(true)}>
                      Ver tutorial
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" size="sm" className="mt-4 w-full justify-start" onClick={() => setIsTutorialOpen(true)}>
                    <Sparkles className="size-4 text-primary" />
                    Reabrir tutorial
                  </Button>
                )}
              </div>

              <nav className="mt-6 flex-1 space-y-5">
                {groupedNavigation.map((group) => (
                  <div key={group.section}>
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/45">{group.section}</p>
                    <div className="mt-2 space-y-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "group flex items-start gap-3 rounded-[22px] border px-4 py-3 transition-all",
                              active
                                ? "border-primary/18 bg-primary/10 shadow-[0_16px_34px_rgba(71,185,239,0.12)]"
                                : "border-transparent text-foreground/80 hover:border-border/80 hover:bg-white hover:text-foreground hover:shadow-[0_10px_22px_rgba(33,59,87,0.05)]",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                                active
                                  ? "border-primary/12 bg-white text-primary"
                                  : "border-border/70 bg-secondary/45 text-foreground/65 group-hover:text-foreground",
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                {item.label}
                                {active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.summary}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="mt-6 rounded-[24px] border border-border/80 bg-white/90 px-4 py-4 text-xs text-muted-foreground shadow-[0_12px_28px_rgba(33,59,87,0.05)]">
                <p className="font-semibold uppercase tracking-[0.18em] text-foreground/60">API base</p>
                <p className="mt-2 break-all leading-5 text-foreground">{appConfig.apiBaseUrl}</p>
              </div>
            </div>
          </aside>

          <div className="flex min-h-screen min-w-0 flex-col">
            <header className="sticky top-0 z-20 border-b border-border/70 bg-background/88 backdrop-blur-xl">
              <div className="container-shell flex min-w-0 flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/45">
                    <span>MagicBox</span>
                    {currentItem ? (
                      <>
                        <ChevronRight className="size-3" />
                        <span>{currentItem.section}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground lg:text-[2rem]">
                      {currentItem?.label || user?.fullName || "MagicBox"}
                    </h1>
                    {currentItem ? <Badge variant="outline">Pantalla activa</Badge> : null}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground lg:text-[15px]">
                    {currentItem?.summary || experienceMeta.description}
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-3 lg:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    {user?.roles?.map((role) => (
                      <Badge key={role} variant="secondary" className="bg-white">
                        {formatRoleLabel(role)}
                      </Badge>
                    ))}
                    {user?.email ? <Badge variant="outline" className="max-w-full truncate">{user.email}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsTutorialOpen(true)}>
                      <Sparkles className="size-4 text-primary" />
                      Tutorial
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border bg-white"
                      onClick={async () => {
                        await logout();
                        router.replace("/login");
                      }}
                    >
                      <LogOut className="size-4" />
                      Salir
                    </Button>
                  </div>
                </div>
              </div>

              <div className="container-shell flex gap-2 overflow-x-auto pb-4 xl:hidden">
                {visibleNavigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap shadow-[0_8px_18px_rgba(33,59,87,0.06)]",
                        active ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </header>

            <main className="container-shell min-w-0 flex-1 py-8 lg:py-10">{children}</main>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
