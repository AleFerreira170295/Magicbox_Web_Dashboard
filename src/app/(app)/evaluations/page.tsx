import { CapabilityGuard } from "@/components/capability-guard";
import { EvaluationsCenter } from "@/features/evaluations/evaluations-center";

export default function EvaluationsPage() {
  return (
    <CapabilityGuard anyOf={["evaluation:read"]}>
      <EvaluationsCenter />
    </CapabilityGuard>
  );
}

