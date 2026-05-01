"use client";

import { useSearchParams } from "next/navigation";
import { RoleGuard } from "@/components/role-guard";
import { DeviceDetailPage } from "@/features/devices/device-detail-page";

export default function DevicesDetailPage() {
  const searchParams = useSearchParams();

  return (
    <RoleGuard allowedRoles={["teacher", "director", "admin", "institution-admin", "family"]}>
      <DeviceDetailPage
        deviceRecordId={searchParams.get("deviceRecordId")}
        overviewState={{
          q: searchParams.get("q"),
          institutionId: searchParams.get("institutionId"),
          scope: searchParams.get("scope") as "all" | "home" | "institution" | null,
          access: searchParams.get("access") as "all" | "owned" | "institution" | "shared" | "unresolved" | null,
          focus: searchParams.get("focus") as "all" | "review" | "no_owner" | "with_owner" | "no_status" | "no_metadata" | "with_metadata" | "online" | "with_activity" | "without_sync" | null,
          ownerUserId: searchParams.get("ownerUserId"),
          ownerUserName: searchParams.get("ownerUserName"),
          page: searchParams.get("page"),
          pageSize: searchParams.get("pageSize"),
        }}
      />
    </RoleGuard>
  );
}
