import { Eye, EyeOff, PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type MapToolbarProps = {
  casesVisible: boolean;
  panelVisible: boolean;
  onToggleCases: () => void;
  onTogglePanel: () => void;
};

export function MapToolbar({
  casesVisible,
  panelVisible,
  onToggleCases,
  onTogglePanel,
}: MapToolbarProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/78 p-1.5 shadow-[0_18px_40px_hsl(var(--shadow)/0.45)] backdrop-blur-md">
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
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onTogglePanel}
        aria-pressed={panelVisible}
      >
        {panelVisible ? <PanelRightClose /> : <PanelRightOpen />}
        {panelVisible ? "Masquer le panneau" : "Afficher le panneau"}
      </Button>
    </div>
  );
}
