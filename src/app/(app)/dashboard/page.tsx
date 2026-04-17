import { RoleGuard } from "@/components/role-guard";
import { DashboardHome } from "@/features/dashboard/dashboard-home";

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "researcher", "admin", "institution-admin"]}>
      <DashboardHome />
    </RoleGuard>
  );
}
