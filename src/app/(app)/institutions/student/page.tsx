"use client";

import { useSearchParams } from "next/navigation";
import { RoleGuard } from "@/components/role-guard";
import { InstitutionStudentProfilePage } from "@/features/institutions/institution-student-profile-page";

export default function InstitutionStudentPage() {
  const searchParams = useSearchParams();

  return (
    <RoleGuard allowedRoles={["admin", "institution-admin", "director"]}>
      <InstitutionStudentProfilePage
        institutionId={searchParams.get("institutionId")}
        groupId={searchParams.get("groupId")}
        studentId={searchParams.get("studentId")}
      />
    </RoleGuard>
  );
}
