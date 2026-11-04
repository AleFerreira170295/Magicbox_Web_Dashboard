"use client";

import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { canAccessOwnedHomeResources, hasAnyUserPermission } from "@/features/auth/permission-contract";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";

const messages: Record<AppLanguage, { title: string; description: string }> = {
  es: { title: "Acceso restringido", description: "Tu cuenta no tiene la capacidad necesaria para abrir este módulo." },
  en: { title: "Restricted access", description: "Your account does not have the capability required to open this module." },
  pt: { title: "Acesso restrito", description: "Sua conta não tem a capacidade necessária para abrir este módulo." },
};

export function CapabilityGuard({
  children,
  anyOf,
  allowOwnedHome = false,
}: {
  children: ReactNode;
  anyOf: readonly string[];
  allowOwnedHome?: boolean;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const allowed = hasAnyUserPermission(user, ...anyOf)
    || (allowOwnedHome && canAccessOwnedHomeResources(user));

  if (allowed) return <>{children}</>;

  const t = messages[language];
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-[2rem] border border-border/80 bg-card/95 p-8 text-center shadow-[0_24px_70px_rgba(31,42,55,0.08)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-foreground">{t.title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.description}</p>
      </div>
    </div>
  );
}
