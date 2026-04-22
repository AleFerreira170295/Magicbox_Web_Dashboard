import { RoleGuard } from "@/components/role-guard";
import { DevicesTable } from "@/features/devices/devices-table";

export default function DevicesPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "admin", "institution-admin", "family"]}>
      <DevicesTable />
    </RoleGuard>
  );
}
