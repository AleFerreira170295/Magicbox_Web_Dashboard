"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import type { AppRole } from "@/features/auth/types";

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user } = useAuth();

  const allowed = allowedRoles.some((role) => user?.roles.includes(role));

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-border bg-card px-8 py-10 text-center shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-foreground">Acceso restringido</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Esta vista está reservada para {allowedRoles.join(", ")}. Puedes seguir navegando por los módulos
          permitidos para tu perfil desde el menú.
        </p>
      </div>
    </div>
  );
}
