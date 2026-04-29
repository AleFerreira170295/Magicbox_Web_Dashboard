"use client";

import { useSearchParams } from "next/navigation";
import { RoleGuard } from "@/components/role-guard";
import { ProfileDetailPage } from "@/features/profiles/profile-detail-page";

export default function ProfilesDetailPage() {
  const searchParams = useSearchParams();

  return (
    <RoleGuard allowedRoles={["admin", "institution-admin", "director"]}>
      <ProfileDetailPage
        kind={searchParams.get("kind")}
        entityId={searchParams.get("entityId")}
        institutionId={searchParams.get("institutionId")}
        classGroupId={searchParams.get("classGroupId")}
      />
    </RoleGuard>
  );
}
