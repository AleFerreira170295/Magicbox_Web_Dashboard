import Link from "next/link";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { DevicesTable } from "@/features/devices/devices-table";

export default function DevicesPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "admin", "institution-admin", "family"]}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Link href="/syncs/cable"><Button>Sincronizar partidas por cable</Button></Link>
        </div>
        <DevicesTable />
      </div>
    </RoleGuard>
  );
}
