import { CapabilityGuard } from "@/components/capability-guard";
import { InstitutionsOverview } from "@/features/institutions/institutions-overview";

export default function InstitutionsPage() {
  return (
    <CapabilityGuard anyOf={["educational_center:read", "educational-center:read"]}>
      <InstitutionsOverview />
    </CapabilityGuard>
  );
}
