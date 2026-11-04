import { CapabilityGuard } from "@/components/capability-guard";
import { SyncsTable } from "@/features/syncs/syncs-table";

export default function SyncsPage() {
  return (
    <CapabilityGuard anyOf={["ble_device:read", "ble-device:read"]} allowOwnedHome>
      <SyncsTable />
    </CapabilityGuard>
  );
}
