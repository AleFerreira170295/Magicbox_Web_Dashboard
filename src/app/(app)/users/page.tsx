import { RoleGuard } from "@/components/role-guard";
import { UsersTable } from "@/features/users/users-table";

export default function UsersPage() {
  return (
    <RoleGuard allowedRoles={["admin", "institution-admin", "family"]}>
      <UsersTable />
    </RoleGuard>
  );
}
