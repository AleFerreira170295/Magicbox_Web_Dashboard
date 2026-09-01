"use client";

import { RoleGuard } from "@/components/role-guard";
import { useAuth } from "@/features/auth/auth-context";
import { FamilyPlayers } from "@/features/profiles/family-players";
import { RelevantProfiles } from "@/features/profiles/relevant-profiles";

export default function ProfilesPage() {
  const { user } = useAuth();
  const isFamily = user?.roles.includes("family") ?? false;

  return (
    <RoleGuard allowedRoles={["family", "admin", "institution-admin", "director"]}>
      {isFamily ? <FamilyPlayers /> : <RelevantProfiles />}
    </RoleGuard>
  );
}
