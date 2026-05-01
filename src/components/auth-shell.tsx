"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { useLanguage } from "@/features/i18n/i18n-context";

type AuthShellPage = "login" | "register" | "forgotPassword" | "verifyOtp" | "resetPassword";

interface AuthShellProps {
  page: AuthShellPage;
  children: ReactNode;
}

export function AuthShell({ page, children }: AuthShellProps) {
  const { t } = useLanguage();
  const content = t.auth.pages[page];

  return (
    <section className="w-full max-w-lg rounded-[36px] border border-white/70 bg-white/95 p-8 shadow-[0_24px_56px_rgba(66,128,164,0.12)] backdrop-blur">
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="text-center">
        <BrandLogo className="mx-auto mb-5 w-full max-w-[240px]" />
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950">{content.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{content.description}</p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}
