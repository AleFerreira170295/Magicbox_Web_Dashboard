import { Suspense } from "react";
import { RoleGuard } from "@/components/role-guard";
import { TerritorialAlertsCenter } from "@/features/dashboard/territorial-alerts-center";

export default function TerritorialAlertsPage() {
  return (
    <RoleGuard allowedRoles={["government-viewer"]}>
      <Suspense fallback={<div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Cargando alertas territoriales...</div>}>
        <TerritorialAlertsCenter />
      </Suspense>
    </RoleGuard>
  );
}
