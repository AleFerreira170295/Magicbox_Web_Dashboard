import { CapabilityGuard } from "@/components/capability-guard";
import { RelevantProfiles } from "@/features/profiles/relevant-profiles";

export default function ProfilesPage() {
  return (
    <CapabilityGuard anyOf={["user:read"]}>
      <RelevantProfiles />
    </CapabilityGuard>
  );
}
