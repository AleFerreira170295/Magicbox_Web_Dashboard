import { RoleGuard } from "@/components/role-guard";
import { SyncsTable } from "@/features/syncs/syncs-table";

export default function SyncsPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "researcher", "family", "admin", "institution-admin"]}>
      <SyncsTable />
    </RoleGuard>
  );
}
