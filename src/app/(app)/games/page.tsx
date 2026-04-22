import { RoleGuard } from "@/components/role-guard";
import { GamesTable } from "@/features/games/games-table";

export default function GamesPage() {
  return (
    <RoleGuard allowedRoles={["teacher", "director", "researcher", "family", "admin", "institution-admin"]}>
      <GamesTable />
    </RoleGuard>
  );
}
