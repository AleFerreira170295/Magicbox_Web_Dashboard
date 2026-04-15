"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Cable, Database, LogOut, Shield, Smartphone } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { appConfig } from "@/lib/api/config";
import { cn } from "@/lib/utils";

type NavigationRole = "teacher" | "director" | "family" | "researcher" | "admin";

const navigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    roles: ["teacher", "director", "researcher", "admin"] satisfies NavigationRole[],
  },
  {
    href: "/syncs",
    label: "Sincronizaciones",
    icon: Cable,
    roles: ["teacher", "director", "researcher", "admin"] satisfies NavigationRole[],
  },
  {
    href: "/games",
    label: "Partidas",
    icon: Database,
    roles: ["teacher", "director", "researcher", "admin"] satisfies NavigationRole[],
  },
  {
    href: "/devices",
    label: "Dispositivos",
    icon: Smartphone,
    roles: ["teacher", "director", "admin"] satisfies NavigationRole[],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const visibleNavigation = navigation.filter((item) =>
    item.roles.some((role) => user?.roles.includes(role)),
  );

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
          <aside className="hidden border-r border-slate-800 bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
            <div className="border-b border-white/10 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-2 text-white">
                  <Shield className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-200">MagicBox</p>
                  <p className="text-lg font-semibold">Web Dashboard</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-300">
                Base web preparada para datos raw, modelo canónico y analítica trazable.
              </p>
            </div>

            <nav className="flex-1 space-y-1 px-4 py-6">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 px-6 py-5 text-xs text-slate-400">
              <p>API base</p>
              <p className="mt-1 break-all text-slate-200">{appConfig.apiBaseUrl}</p>
            </div>
          </aside>

          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
              <div className="container-shell flex h-16 items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{user?.fullName || "MagicBox"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{user?.email}</span>
                    {user?.roles.map((role) => (
                      <Badge key={role} variant="secondary">{role}</Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
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
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-white text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </header>

            <main className="container-shell flex-1 py-8">{children}</main>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
