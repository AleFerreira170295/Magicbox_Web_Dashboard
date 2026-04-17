import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_16px_30px_rgba(71,185,239,0.26)] hover:-translate-y-0.5 hover:bg-primary/90",
        outline: "border border-border bg-white/92 text-foreground shadow-[0_10px_22px_rgba(66,128,164,0.08)] hover:bg-muted/70",
        ghost: "text-foreground hover:bg-muted/75",
        secondary: "bg-secondary text-secondary-foreground shadow-[0_10px_22px_rgba(66,128,164,0.08)] hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_12px_24px_rgba(220,91,91,0.18)] hover:bg-destructive/90",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
