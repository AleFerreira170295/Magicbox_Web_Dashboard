import Link from "next/link";
import { CapabilityGuard } from "@/components/capability-guard";
import { Button } from "@/components/ui/button";
import { DevicesTable } from "@/features/devices/devices-table";

export default function DevicesPage() {
  return (
    <CapabilityGuard anyOf={["ble_device:read", "ble-device:read"]} allowOwnedHome>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Link href="/syncs/cable"><Button>Sincronizar partidas por cable</Button></Link>
        </div>
        <DevicesTable />
      </div>
    </CapabilityGuard>
  );
}
