"use client";

import { TeacherDashboard } from "@/features/dashboard/teacher-dashboard";
import { SuperadminDashboard } from "@/features/dashboard/superadmin-dashboard";
import { useAuth } from "@/features/auth/auth-context";

export function DashboardHome() {
  const { user } = useAuth();

  if (user?.roles.includes("admin")) {
    return <SuperadminDashboard />;
  }

  return <TeacherDashboard />;
}
