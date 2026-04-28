"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, Building2, Cable, Database, KeyRound, LogOut, Settings, ShieldAlert, Sparkles, Smartphone, UserRound, Users } from "lucide-react";
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

type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: NavigationRole[];
  isVisible?: (user: { roles?: string[]; permissions?: string[] } | null | undefined) => boolean;
};

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
        "Este acceso prioriza lectura territorial, alertas ejecutivas y seguimiento agregado, sin exponer módulos técnicos u operativos que no corresponden a este perfil.",
    };
  }

  if (user?.roles?.includes("researcher")) {
    return {
      title: "Vista investigación",
      description:
        "Este acceso prioriza evidencia visible, consistencia entre sync y partida, y lectura de muestra, manteniendo fuera los módulos administrativos o de hardware que no forman parte del trabajo investigador.",
    };
  }

  if (user?.roles?.includes("family")) {
    return {
      title: "Vista familia",
      description:
        "Este acceso prioriza una lectura simple y cuidada de actividad visible, manteniendo fuera módulos técnicos, administrativos o de hardware que no corresponden a este perfil.",
    };
  }

  if (user?.roles?.includes("teacher")) {
    return {
      title: "Vista docente",
      description:
        "Este acceso prioriza juego, dispositivos y sincronizaciones visibles para operar el aula con rapidez, sin mezclarlo con módulos administrativos que no aportan a la jornada.",
    };
  }

  if (user?.roles?.includes("institution-admin") || user?.roles?.includes("director")) {
    return {
      title: "Vista institucional",
      description:
        "Este acceso se concentra en seguimiento institucional, gobernanza cotidiana y control operativo del alcance visible por ACL.",
    };
  }

  if (user?.roles?.includes("admin")) {
    return {
      title: "Vista plataforma",
      description:
        "Este acceso mantiene visión global, módulos técnicos y superficies transversales para operar toda la plataforma.",
    };
  }

  return {
    title: "Vista institucional",
    description:
      "El dashboard va a convivir embebido con la web de MagicBox, así que empezamos a moverlo hacia un lenguaje menos técnico y más educativo.",
  };
}

const navigation: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    roles: ["teacher", "director", "researcher", "family", "admin", "institution-admin", "government-viewer"] satisfies NavigationRole[],
  },
  {
    href: "/territorial-alerts",
    label: "Alertas territoriales",
    icon: ShieldAlert,
    roles: ["government-viewer"] satisfies NavigationRole[],
  },
  {
    href: "/territorial-overview",
    label: "Territorios e instituciones",
    icon: Building2,
    roles: ["government-viewer"] satisfies NavigationRole[],
  },
  {
    href: "/syncs",
    label: "Sincronizaciones",
    icon: Cable,
    roles: ["teacher", "director", "researcher", "family", "admin", "institution-admin"] satisfies NavigationRole[],
  },
  {
    href: "/games",
    label: "Partidas",
    icon: Database,
    roles: ["teacher", "director", "researcher", "family", "admin", "institution-admin"] satisfies NavigationRole[],
  },
  {
    href: "/users",
    label: "Usuarios",
    icon: Users,
    roles: ["admin", "institution-admin", "family"] satisfies NavigationRole[],
  },
  {
    href: "/permissions",
    label: "Permisos",
    icon: KeyRound,
    roles: ["admin", "institution-admin"] satisfies NavigationRole[],
    isVisible: (user) => canAccessPermissionsModule(user),
  },
  {
    href: "/institutions",
    label: "Instituciones",
    icon: Building2,
    roles: ["admin", "institution-admin", "director"] satisfies NavigationRole[],
  },
  {
    href: "/health",
    label: "Salud",
    icon: Activity,
    roles: ["admin"] satisfies NavigationRole[],
  },
  {
    href: "/profiles",
    label: "Perfiles",
    icon: UserRound,
    roles: ["admin", "institution-admin", "director"] satisfies NavigationRole[],
  },
  {
    href: "/settings",
    label: "Configuración",
    icon: Settings,
    roles: ["admin"] satisfies NavigationRole[],
  },
  {
    href: "/devices",
    label: "Dispositivos",
    icon: Smartphone,
    roles: ["teacher", "director", "admin", "institution-admin", "family"] satisfies NavigationRole[],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const experienceMeta = getExperienceMeta(user);
  const shouldAutoOpenTutorial = Boolean(user?.id && !hasCompletedTutorial(user.id));
  const tutorialVisible = isTutorialOpen || shouldAutoOpenTutorial;

  const visibleNavigation = useMemo(
    () =>
      navigation.filter((item) => {
        const allowedByRole = item.roles.some((role) => user?.roles.includes(role));
        if (!allowedByRole) return false;
        return item.isVisible ? item.isVisible(user) : true;
      }),
    [user],
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

        <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
          <aside className="hidden border-r border-border/60 bg-sidebar/95 text-sidebar-foreground lg:flex lg:flex-col lg:backdrop-blur">
            <div className="border-b border-border/60 px-6 py-8">
              <div className="space-y-4">
                <BrandLogo variant="icon" className="w-14" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">MagicBox</p>
                  <p className="text-xl font-semibold tracking-[-0.03em] text-foreground">Web Dashboard</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                Una base visual más cercana al sitio público, pensada para seguimiento pedagógico claro,
                cálido y accionable.
              </p>
            </div>

            <div className="px-6 pt-6">
              <div className="soft-panel rounded-[28px] p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  {experienceMeta.title}
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{experienceMeta.description}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-4 px-0 text-primary hover:bg-transparent"
                  onClick={() => setIsTutorialOpen(true)}
                >
                  Ver tutorial
                </Button>
              </div>
            </div>

            <nav className="flex-1 space-y-2 px-4 py-6">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                      active
                        ? "bg-primary text-white shadow-[0_16px_30px_rgba(71,185,239,0.24)]"
                        : "text-foreground/80 hover:bg-white/90 hover:text-foreground hover:shadow-[0_10px_22px_rgba(66,128,164,0.08)]",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border/60 px-6 py-5 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-[0.18em] text-foreground/70">API base</p>
              <p className="mt-2 break-all leading-5 text-foreground">{appConfig.apiBaseUrl}</p>
            </div>
          </aside>

          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-20 border-b border-border/60 bg-background/86 backdrop-blur-xl">
              <div className="container-shell flex min-h-18 items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-base font-semibold tracking-[-0.03em] text-foreground">{user?.fullName || "MagicBox"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{user?.email}</span>
                    {user?.roles.map((role) => (
                      <Badge key={role} variant="secondary" className="bg-white/90">
                        {formatRoleLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-border bg-white/90"
                  onClick={async () => {
                    await logout();
                    router.replace("/login");
                  }}
                >
                  <LogOut className="size-4" />
                  Salir
                </Button>
              </div>

              <div className="container-shell flex gap-2 overflow-x-auto pb-4 lg:hidden">
                {visibleNavigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap shadow-[0_8px_18px_rgba(66,128,164,0.08)]",
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

            <main className="container-shell flex-1 py-10">{children}</main>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
