import { Suspense } from "react";
import { RoleGuard } from "@/components/role-guard";
import { TerritorialOverviewCenter } from "@/features/dashboard/territorial-overview-center";

export default function TerritorialOverviewPage() {
  return (
    <RoleGuard allowedRoles={["government-viewer"]}>
      <Suspense fallback={<div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Cargando territorios e instituciones...</div>}>
        <TerritorialOverviewCenter />
      </Suspense>
    </RoleGuard>
  );
}
