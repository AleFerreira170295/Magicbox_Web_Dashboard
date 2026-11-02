import { CapabilityGuard } from "@/components/capability-guard";
import { DeviceImportCenter } from "@/features/device-import/device-import-center";

export default function CableSyncPage() {
  return (
    <CapabilityGuard anyOf={["ble_device:read", "ble-device:read"]} allowOwnedHome>
      <DeviceImportCenter />
    </CapabilityGuard>
  );
}
