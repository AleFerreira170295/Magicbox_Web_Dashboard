import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-[linear-gradient(90deg,#eef7ff_0%,#f8fcff_50%,#eef7ff_100%)]", className)} />;
}
