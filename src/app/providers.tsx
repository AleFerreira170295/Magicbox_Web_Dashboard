"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { makeQueryClient } from "@/lib/query-client";
import { AuthProvider } from "@/features/auth/auth-context";
import { LanguageProvider } from "@/features/i18n/i18n-context";
import { NotificationsProvider } from "@/components/ui/notifications";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <NotificationsProvider>
          <AuthProvider>{children}</AuthProvider>
        </NotificationsProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
