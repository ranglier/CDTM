import { Eye, EyeOff, PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { MapDisplayMode } from "@/map/types";

type MapToolbarProps = {
  casesVisible: boolean;
  panelVisible: boolean;
  displayMode: MapDisplayMode;
  onDisplayModeChange: (mode: MapDisplayMode) => void;
  onToggleCases: () => void;
  onTogglePanel: () => void;
};

export function MapToolbar({
  casesVisible,
  panelVisible,
  displayMode,
  onDisplayModeChange,
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
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={displayMode === "faction" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onDisplayModeChange("faction")}
        >
          Faction
        </Button>
        <Button
          type="button"
          variant={displayMode === "influence" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onDisplayModeChange("influence")}
        >
          Influence
        </Button>
        <Button
          type="button"
          variant={displayMode === "topographic" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onDisplayModeChange("topographic")}
        >
          Topo
        </Button>
      </div>
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
