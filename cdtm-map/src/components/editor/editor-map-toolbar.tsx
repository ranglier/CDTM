import { Eye, EyeOff } from "lucide-react";

import type { EditorLocalityStatusFilter } from "@/editor/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type EditorMapToolbarProps = {
  casesVisible: boolean;
  statusFilter: EditorLocalityStatusFilter;
  onToggleCases: () => void;
  onStatusFilterChange: (filter: EditorLocalityStatusFilter) => void;
};

const STATUS_FILTER_OPTIONS: Array<{ value: EditorLocalityStatusFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "published", label: "Publies" },
  { value: "archived", label: "Archives" },
];

export function EditorMapToolbar({
  casesVisible,
  statusFilter,
  onToggleCases,
  onStatusFilterChange,
}: EditorMapToolbarProps) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-[28px] border border-border/80 bg-background/78 p-1.5 shadow-[0_18px_40px_hsl(var(--shadow)/0.45)] backdrop-blur-md">
      <Button
        type="button"
        variant={casesVisible ? "secondary" : "outline"}
        size="sm"
        onClick={onToggleCases}
        aria-pressed={casesVisible}
      >
        {casesVisible ? <EyeOff /> : <Eye />}
        {casesVisible ? "Masquer les cases" : "Afficher les cases"}
      </Button>
      <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
      <div className="flex flex-wrap items-center gap-1">
        {STATUS_FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={statusFilter === option.value ? "secondary" : "outline"}
            size="sm"
            onClick={() => onStatusFilterChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
