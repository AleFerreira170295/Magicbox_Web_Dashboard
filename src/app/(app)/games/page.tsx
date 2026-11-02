import { CapabilityGuard } from "@/components/capability-guard";
import { GamesTable } from "@/features/games/games-table";

export default function GamesPage() {
  return (
    <CapabilityGuard anyOf={["game_data:read", "game-data:read"]} allowOwnedHome>
      <GamesTable />
    </CapabilityGuard>
  );
}
