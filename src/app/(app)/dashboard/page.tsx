import { RoleGuard } from "@/components/role-guard";
import { DashboardHome } from "@/features/dashboard/dashboard-home";

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "researcher", "family", "admin", "institution-admin", "government-viewer"]}>
      <DashboardHome />
    </RoleGuard>
  );
}
