import type { MapDisplayMode, StableCaseProperties } from "@/map/types";

const BLANK_CASE_ROW = [{ label: "Etat", value: "Case vierge" }];

export function buildCaseHoverRows(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
): Array<{ label: string; value: string }> {
  if (!properties) {
    return BLANK_CASE_ROW;
  }

  if (displayMode === "faction") {
    return properties.faction
      ? [{ label: "Faction", value: properties.faction }]
      : BLANK_CASE_ROW;
  }

  if (displayMode === "influence") {
    return properties.controleur
      ? [{ label: "Controleur", value: properties.controleur }]
      : properties.faction
        ? [{ label: "Faction", value: properties.faction }]
        : BLANK_CASE_ROW;
  }

  const rows = [
    properties.terrain_type ? { label: "Terrain", value: properties.terrain_type } : null,
    properties.colline ? { label: "Attribut", value: "Colline" } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return rows.length > 0 ? rows : BLANK_CASE_ROW;
}
