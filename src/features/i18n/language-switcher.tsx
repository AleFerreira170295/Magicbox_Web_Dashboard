"use client";

import { cn } from "@/lib/utils";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";

const options: Array<{ code: AppLanguage; short: string }> = [
  { code: "es", short: "ES" },
  { code: "en", short: "EN" },
  { code: "pt", short: "PT" },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">{t.common.languageLabel}</span>
      <div className="inline-flex rounded-full border border-border bg-white p-1 shadow-sm">
        {options.map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => setLanguage(option.code)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              language === option.code ? "bg-primary text-white" : "text-foreground/70 hover:bg-secondary",
            )}
            aria-pressed={language === option.code}
          >
            {option.short}
          </button>
        ))}
      </div>
    </div>
  );
}
