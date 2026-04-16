import { RoleGuard } from "@/components/role-guard";
import { SystemSettingsCenter } from "@/features/settings/system-settings-center";

export default function SettingsPage() {
  return (
    <RoleGuard allowedRoles={["admin"]}>
      <SystemSettingsCenter />
    </RoleGuard>
  );
}
