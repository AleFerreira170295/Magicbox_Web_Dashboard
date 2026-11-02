"use client";

import { useSearchParams } from "next/navigation";
import { CapabilityGuard } from "@/components/capability-guard";
import { ProfileDetailPage } from "@/features/profiles/profile-detail-page";

export default function ProfilesDetailPage() {
  const searchParams = useSearchParams();

  return (
    <CapabilityGuard anyOf={["user:read"]}>
      <ProfileDetailPage
        kind={searchParams.get("kind")}
        entityId={searchParams.get("entityId")}
        institutionId={searchParams.get("institutionId")}
        classGroupId={searchParams.get("classGroupId")}
      />
    </CapabilityGuard>
  );
}
