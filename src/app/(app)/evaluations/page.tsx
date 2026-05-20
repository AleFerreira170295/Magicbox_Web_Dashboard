import { RoleGuard } from "@/components/role-guard";
import { EvaluationsCenter } from "@/features/evaluations/evaluations-center";

export default function EvaluationsPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "researcher", "admin", "institution-admin"]}>
      <EvaluationsCenter />
    </RoleGuard>
  );
}

