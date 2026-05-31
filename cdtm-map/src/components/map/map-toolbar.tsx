import { ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { MapDisplayMode } from "@/map/types";

type MapToolbarProps = {
  casesVisible: boolean;
  localitiesVisible: boolean;
  landmarksVisible: boolean;
  routesVisible: boolean;
  panelVisible: boolean;
  displayMode: MapDisplayMode;
  onDisplayModeChange: (mode: MapDisplayMode) => void;
  onToggleCases: () => void;
  onToggleLocalities: () => void;
  onToggleLandmarks: () => void;
  onToggleRoutes: () => void;
  onToggleAllObjects: () => void;
  onTogglePanel: () => void;
};

export function MapToolbar({
  casesVisible,
  localitiesVisible,
  landmarksVisible,
  routesVisible,
  panelVisible,
  displayMode,
  onDisplayModeChange,
  onToggleCases,
  onToggleLocalities,
  onToggleLandmarks,
  onToggleRoutes,
  onToggleAllObjects,
  onTogglePanel,
}: MapToolbarProps) {
  const objectsVisible = localitiesVisible || landmarksVisible || routesVisible;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/78 p-1.5 shadow-[0_18px_40px_hsl(var(--shadow)/0.45)] backdrop-blur-md">
      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-border/80 bg-background/70 px-4 text-sm font-medium text-foreground outline-none transition hover:bg-background [&::-webkit-details-marker]:hidden">
          <span>Cases</span>
          <ChevronDown className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 top-11 z-30 min-w-56 rounded-2xl border border-border/80 bg-background/96 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant={casesVisible ? "secondary" : "outline"}
              className="justify-start"
              onClick={onToggleCases}
            >
              {casesVisible ? "Masquer les cases" : "Afficher les cases"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={displayMode === "faction" ? "secondary" : "outline"}
              className="justify-start"
              onClick={() => onDisplayModeChange("faction")}
            >
              Faction
            </Button>
            <Button
              type="button"
              size="sm"
              variant={displayMode === "influence" ? "secondary" : "outline"}
              className="justify-start"
              onClick={() => onDisplayModeChange("influence")}
            >
              Influence
            </Button>
            <Button
              type="button"
              size="sm"
              variant={displayMode === "topographic" ? "secondary" : "outline"}
              className="justify-start"
              onClick={() => onDisplayModeChange("topographic")}
            >
              Topo
            </Button>
          </div>
        </div>
      </details>
      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-border/80 bg-background/70 px-4 text-sm font-medium text-foreground outline-none transition hover:bg-background [&::-webkit-details-marker]:hidden">
          <span>Objets</span>
          <ChevronDown className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 top-11 z-30 min-w-56 rounded-2xl border border-border/80 bg-background/96 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant={objectsVisible ? "secondary" : "outline"}
              className="justify-start"
              onClick={onToggleAllObjects}
            >
              {objectsVisible ? "Masquer les objets" : "Afficher les objets"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={localitiesVisible ? "secondary" : "outline"}
              className="justify-start"
              onClick={onToggleLocalities}
            >
              Localites
            </Button>
            <Button
              type="button"
              size="sm"
              variant={landmarksVisible ? "secondary" : "outline"}
              className="justify-start"
              onClick={onToggleLandmarks}
            >
              Landmarks
            </Button>
            <Button
              type="button"
              size="sm"
              variant={routesVisible ? "secondary" : "outline"}
              className="justify-start"
              onClick={onToggleRoutes}
            >
              Routes
            </Button>
          </div>
        </div>
      </details>
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
