import { RoleGuard } from "@/components/role-guard";
import { DeviceImportCenter } from "@/features/device-import/device-import-center";

export default function CableSyncPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "family", "admin", "institution-admin"]}>
      <DeviceImportCenter />
    </RoleGuard>
  );
}
