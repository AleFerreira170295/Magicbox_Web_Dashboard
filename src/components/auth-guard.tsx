"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";

const authGuardMessages: Record<AppLanguage, { restoring: string }> = {
  es: { restoring: "Restaurando sesión..." },
  en: { restoring: "Restoring session..." },
  pt: { restoring: "Restaurando sessão..." },
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const { language } = useLanguage();
  const t = authGuardMessages[language];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-2xl border border-border bg-white px-6 py-5 text-sm text-muted-foreground shadow-sm">
          {t.restoring}
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return <>{children}</>;
}
