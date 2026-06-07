import { ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MapDisplayMode } from "@/map/types";

type MapToolbarProps = {
  casesVisible: boolean;
  localitiesVisible: boolean;
  landmarksVisible: boolean;
  routesVisible: boolean;
  objectDisplayMode: "icons" | "points";
  panelVisible: boolean;
  displayMode: MapDisplayMode;
  showObjectControls?: boolean;
  showPanelToggle?: boolean;
  rightActions?: ReactNode;
  className?: string;
  onInteraction?: () => void;
  onDisplayModeChange: (mode: MapDisplayMode) => void;
  onToggleCases: () => void;
  onToggleLocalities: () => void;
  onToggleLandmarks: () => void;
  onToggleRoutes: () => void;
  onToggleObjectDisplayMode: () => void;
  onToggleAllObjects: () => void;
  onTogglePanel: () => void;
};

export function MapToolbar({
  casesVisible,
  localitiesVisible,
  landmarksVisible,
  routesVisible,
  objectDisplayMode,
  panelVisible,
  displayMode,
  showObjectControls = true,
  showPanelToggle = true,
  rightActions,
  className,
  onInteraction,
  onDisplayModeChange,
  onToggleCases,
  onToggleLocalities,
  onToggleLandmarks,
  onToggleRoutes,
  onToggleObjectDisplayMode,
  onToggleAllObjects,
  onTogglePanel,
}: MapToolbarProps) {
  const objectsVisible = localitiesVisible || landmarksVisible || routesVisible;

  return (
    <div
      className={cn(
        "flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-between gap-1.5 rounded-[18px] border border-border/80 bg-background/82 p-1.5 shadow-[0_18px_40px_hsl(var(--shadow)/0.45)] backdrop-blur-md sm:max-w-[calc(100vw-2rem)] sm:gap-2 sm:rounded-[20px]",
        className,
      )}
      onFocusCapture={() => onInteraction?.()}
      onPointerDownCapture={() => onInteraction?.()}
      onPointerOverCapture={() => onInteraction?.()}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <details className="group relative">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 text-sm font-medium text-foreground outline-none transition hover:bg-background sm:gap-2 sm:px-4 [&::-webkit-details-marker]:hidden">
            <span>Cases</span>
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </summary>
          <div className="absolute left-0 top-11 z-30 min-w-52 rounded-2xl border border-border/80 bg-background/96 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)] sm:min-w-56">
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
        {showObjectControls ? (
          <details className="group relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 text-sm font-medium text-foreground outline-none transition hover:bg-background sm:gap-2 sm:px-4 [&::-webkit-details-marker]:hidden">
              <span>Objets</span>
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-11 z-30 min-w-52 rounded-2xl border border-border/80 bg-background/96 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)] sm:min-w-56">
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
        ) : null}
        {showObjectControls ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="px-3 sm:px-3.5"
            onClick={onToggleObjectDisplayMode}
          >
            <span className="sm:hidden">
              {objectDisplayMode === "icons" ? "Icones" : "Points"}
            </span>
            <span className="hidden sm:inline">
              {objectDisplayMode === "icons"
                ? "Objets : icones"
                : "Objets : points"}
            </span>
          </Button>
        ) : null}
      </div>
      {rightActions || showPanelToggle ? (
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {rightActions}
          {showPanelToggle ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 hidden h-6 sm:block"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="px-3 sm:px-3.5"
                onClick={onTogglePanel}
                aria-pressed={panelVisible}
              >
                {panelVisible ? <PanelRightClose /> : <PanelRightOpen />}
                <span className="sm:hidden">
                  {panelVisible ? "Fermer" : "Infos"}
                </span>
                <span className="hidden sm:inline">
                  {panelVisible ? "Masquer le panneau" : "Afficher le panneau"}
                </span>
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
