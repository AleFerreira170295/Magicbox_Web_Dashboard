import { RoleGuard } from "@/components/role-guard";
import { DeviceImportCenter } from "@/features/device-import/device-import-center";

export default function DeviceImportPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "family", "admin", "institution-admin"]}>
      <DeviceImportCenter />
    </RoleGuard>
  );
}
