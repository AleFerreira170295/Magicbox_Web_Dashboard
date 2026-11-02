"use client";

import { useSearchParams } from "next/navigation";
import { CapabilityGuard } from "@/components/capability-guard";
import { InstitutionStudentProfilePage } from "@/features/institutions/institution-student-profile-page";

export default function InstitutionStudentPage() {
  const searchParams = useSearchParams();

  return (
    <CapabilityGuard anyOf={["student:read"]}>
      <InstitutionStudentProfilePage
        institutionId={searchParams.get("institutionId")}
        groupId={searchParams.get("groupId")}
        studentId={searchParams.get("studentId")}
      />
    </CapabilityGuard>
  );
}
