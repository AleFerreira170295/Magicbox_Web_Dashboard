import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "wordmark";
  className?: string;
}

export function BrandLogo({ variant = "wordmark", className }: BrandLogoProps) {
  if (variant === "icon") {
    return <img src="/branding/logo-icon.png" alt="MagicBox" className={cn("h-auto w-14 shrink-0", className)} />;
  }

  return <img src="/branding/logo-label.png" alt="MagicBox" className={cn("h-auto w-full max-w-[280px]", className)} />;
}
