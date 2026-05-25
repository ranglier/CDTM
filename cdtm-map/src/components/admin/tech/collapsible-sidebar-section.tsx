"use client";

import type { CollapsibleSidebarSectionProps } from "@/components/admin/tech/types";

export function CollapsibleSidebarSection({
  title,
  selected,
  onSelect,
  open,
  onToggle,
  children,
}: CollapsibleSidebarSectionProps) {
  return (
    <div className="rounded-[18px] border border-border/60 bg-background/25">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          className={`min-w-0 flex-1 rounded-[12px] px-2 py-1 text-left text-sm font-semibold transition ${
            selected ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-background/45"
          }`}
          onClick={onSelect}
        >
          {title}
        </button>
        <button
          type="button"
          aria-label={open ? `Replier ${title}` : `Deplier ${title}`}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-background/45 hover:text-foreground"
          onClick={onToggle}
        >
          <span className={`text-sm transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">
            &gt;
          </span>
        </button>
      </div>
      {open ? <div className="border-t border-border/50 p-3">{children}</div> : null}
    </div>
  );
}
