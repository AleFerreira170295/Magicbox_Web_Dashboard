"use client";

import { FamilyDashboard } from "@/features/dashboard/family-dashboard";
import { InstitutionDashboard } from "@/features/dashboard/institution-dashboard";
import { ResearcherDashboard } from "@/features/dashboard/researcher-dashboard";
import { TeacherDashboard } from "@/features/dashboard/teacher-dashboard";
import { SuperadminDashboard } from "@/features/dashboard/superadmin-dashboard";
import { useAuth } from "@/features/auth/auth-context";

export function DashboardHome() {
  const { user } = useAuth();

  if (
    user?.roles.includes("admin")
    || user?.roles.includes("government-viewer")
  ) {
    return <SuperadminDashboard />;
  }

  if (user?.roles.includes("institution-admin") || user?.roles.includes("director")) {
    return <InstitutionDashboard />;
  }

  if (user?.roles.includes("researcher")) {
    return <ResearcherDashboard />;
  }

  if (user?.roles.includes("family")) {
    return <FamilyDashboard />;
  }

  return <TeacherDashboard />;
}
