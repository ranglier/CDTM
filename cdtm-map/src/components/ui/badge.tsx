import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/35 bg-primary/12 text-primary",
        secondary: "border-border/80 bg-secondary/70 text-secondary-foreground",
        outline: "border-border/80 bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
