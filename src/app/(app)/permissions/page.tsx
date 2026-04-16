import { RoleGuard } from "@/components/role-guard";
import { PermissionsCenter } from "@/features/permissions/permissions-center";

export default function PermissionsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <PermissionsCenter />
    </RoleGuard>
  );
}
