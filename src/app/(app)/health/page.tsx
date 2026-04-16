import { RoleGuard } from "@/components/role-guard";
import { SystemHealthDashboard } from "@/features/health/system-health-dashboard";

export default function HealthPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <SystemHealthDashboard />
    </RoleGuard>
  );
}
