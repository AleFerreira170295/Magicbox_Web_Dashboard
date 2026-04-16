import { RoleGuard } from "@/components/role-guard";
import { InstitutionsOverview } from "@/features/institutions/institutions-overview";

export default function InstitutionsPage() {
  return (
    <RoleGuard allowedRoles={["admin", "institution-admin", "director"]}>
      <InstitutionsOverview />
    </RoleGuard>
  );
}
