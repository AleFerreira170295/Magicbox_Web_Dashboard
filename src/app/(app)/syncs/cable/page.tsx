import { RoleGuard } from "@/components/role-guard";
import { DeviceImportCenter } from "@/features/device-import/device-import-center";

const activeAccountRoles = ["teacher", "director", "researcher", "family", "admin", "institution-admin", "government-viewer"] as const;

export default function CableSyncPage() {
  return (
    <RoleGuard allowedRoles={[...activeAccountRoles]}>
      <DeviceImportCenter />
    </RoleGuard>
  );
}
