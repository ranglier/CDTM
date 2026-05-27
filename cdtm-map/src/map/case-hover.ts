import type { MapDisplayMode, StableCaseProperties } from "@/map/types";

export function buildCaseHoverRows(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
): Array<{ label: string; value: string }> {
  if (!properties) {
    return [];
  }

  if (displayMode === "faction") {
    return properties.faction ? [{ label: "Faction", value: properties.faction }] : [];
  }

  if (displayMode === "influence") {
    return properties.controleur
      ? [{ label: "Controleur", value: properties.controleur }]
      : properties.faction
        ? [{ label: "Faction", value: properties.faction }]
        : [];
  }

  return [
    properties.terrain_cat ? { label: "Categorie", value: properties.terrain_cat } : null,
    properties.terrain_type ? { label: "Terrain", value: properties.terrain_type } : null,
    properties.relief ? { label: "Relief", value: properties.relief } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}
