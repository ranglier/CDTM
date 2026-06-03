import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[28px] border border-border/70 bg-card/88 text-card-foreground shadow-[0_32px_80px_hsl(var(--shadow)/0.45)] backdrop-blur-md",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
