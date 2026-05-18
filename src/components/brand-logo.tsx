import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "icon" | "wordmark";
  className?: string;
}

export function BrandLogo({ variant = "wordmark", className }: BrandLogoProps) {
  if (variant === "icon") {
    return <Image src="/branding/logo-icon.png" alt="MagicBox" width={2250} height={2250} className={cn("h-auto w-14 shrink-0", className)} priority />;
  }

  return <Image src="/branding/logo-label.png" alt="MagicBox" width={4047} height={1064} className={cn("h-auto w-full max-w-[280px]", className)} priority />;
}
