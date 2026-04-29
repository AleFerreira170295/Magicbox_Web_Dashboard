import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.01em] shadow-[0_6px_14px_rgba(33,59,87,0.05)]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/14 text-[#0f6f99]",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-accent text-accent-foreground",
        outline: "border-border bg-white text-foreground",
        warning: "border-transparent bg-amber-100 text-amber-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
