import { RoleGuard } from "@/components/role-guard";
import { RelevantProfiles } from "@/features/profiles/relevant-profiles";

export default function ProfilesPage() {
  return (
    <RoleGuard allowedRoles={["admin", "institution-admin", "director"]}>
      <RelevantProfiles />
    </RoleGuard>
  );
}
