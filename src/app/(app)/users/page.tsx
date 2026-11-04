import { CapabilityGuard } from "@/components/capability-guard";
import { UsersTable } from "@/features/users/users-table";

export default function UsersPage() {
  return (
    <CapabilityGuard anyOf={["user:read"]}>
      <UsersTable />
    </CapabilityGuard>
  );
}
