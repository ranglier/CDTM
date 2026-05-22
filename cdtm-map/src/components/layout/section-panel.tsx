import type { HTMLAttributes, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function SectionPanel({ children, className, ...props }: SectionPanelProps) {
  return (
    <Card className={cn("overflow-hidden", className)} {...props}>
      {children}
    </Card>
  );
}
