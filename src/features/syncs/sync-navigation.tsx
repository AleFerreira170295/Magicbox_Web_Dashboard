"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cable, History } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { useLanguage } from "@/features/i18n/i18n-context";
import { cn } from "@/lib/utils";

const messages = {
  es: { history: "Historial de syncs", cable: "Sync por cable" },
  en: { history: "Sync history", cable: "Cable sync" },
  pt: { history: "Histórico de syncs", cable: "Sync por cabo" },
};

const cableRoles = new Set(["teacher", "director", "family", "admin", "institution-admin"]);

export function SyncNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = messages[language];
  const canUseCableSync = user?.roles.some((role) => cableRoles.has(role)) || false;

  return (
    <nav aria-label="Navegación de sincronizaciones" className="flex w-full gap-2 overflow-x-auto rounded-2xl border bg-card/80 p-2">
      <Link
        href="/syncs"
        className={cn(buttonVariants({ variant: pathname === "/syncs" ? "default" : "ghost", size: "sm" }), "shrink-0")}
      >
        <History className="size-4" />
        {t.history}
      </Link>
      {canUseCableSync ? (
        <Link
          href="/syncs/cable"
          className={cn(buttonVariants({ variant: pathname.startsWith("/syncs/cable") ? "default" : "ghost", size: "sm" }), "shrink-0")}
        >
          <Cable className="size-4" />
          {t.cable}
        </Link>
      ) : null}
    </nav>
  );
}
