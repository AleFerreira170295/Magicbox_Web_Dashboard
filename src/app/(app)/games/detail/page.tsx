"use client";

import { useSearchParams } from "next/navigation";
import { RoleGuard } from "@/components/role-guard";
import { GameDetailPage } from "@/features/games/game-detail-page";

export default function GamesDetailRoute() {
  const searchParams = useSearchParams();

  return (
    <RoleGuard allowedRoles={["teacher", "director", "researcher", "family", "admin", "institution-admin"]}>
      <GameDetailPage
        gameRecordId={searchParams.get("gameRecordId")}
        overviewState={{
          q: searchParams.get("q"),
          institutionId: searchParams.get("institutionId"),
          playerMode: (searchParams.get("playerMode") as "all" | "manual" | "mixed" | "registered" | null) ?? null,
          access: (searchParams.get("access") as "all" | "owned" | "institution" | "shared" | "unresolved" | null) ?? null,
          ownerUserId: searchParams.get("ownerUserId"),
          ownerUserName: searchParams.get("ownerUserName"),
          bleDeviceId: searchParams.get("bleDeviceId"),
          deviceId: searchParams.get("deviceId"),
          deviceName: searchParams.get("deviceName"),
          page: searchParams.get("page"),
          pageSize: searchParams.get("pageSize"),
        }}
      />
    </RoleGuard>
  );
}
