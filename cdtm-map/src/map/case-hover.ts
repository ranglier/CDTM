import type { MapDisplayMode, StableCaseProperties } from "@/map/types";

const BLANK_CASE_ROW = [{ label: "Etat", value: "Case vierge" }];

type CaseHoverRow = { label: string; value: string };

function normalizeControlType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatCaseActor(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildControlTypeHoverRow(
  properties: StableCaseProperties,
): CaseHoverRow | null {
  const controlType = properties.controle_type?.trim();

  if (!controlType) {
    return null;
  }

  const normalizedControlType = normalizeControlType(controlType);

  if (normalizedControlType === "total" || normalizedControlType === "aucun") {
    return null;
  }

  const faction = formatCaseActor(properties.faction);
  const controller = formatCaseActor(properties.controleur);

  switch (normalizedControlType) {
    case "occupe":
    case "occupation":
      return {
        label: "Controle",
        value: controller ? `Occupe par ${controller}` : "Occupe",
      };
    case "vassal":
    case "vassalite":
    case "vassalise":
      return {
        label: "Controle",
        value: controller ? `Vassal de ${controller}` : "Vassalite",
      };
    case "conteste":
      return {
        label: "Controle",
        value:
          faction && controller && faction !== controller
            ? `Conflit entre ${faction} et ${controller}`
            : "Conflit",
      };
    case "partiel":
      return {
        label: "Controle",
        value: controller
          ? `Controle partiel de ${controller}`
          : "Controle partiel",
      };
    default:
      return { label: "Controle", value: controlType };
  }
}

function appendControlTypeRow(
  rows: CaseHoverRow[],
  properties: StableCaseProperties,
): CaseHoverRow[] {
  const controlTypeRow = buildControlTypeHoverRow(properties);

  return controlTypeRow ? [...rows, controlTypeRow] : rows;
}

export function getCaseHoverTitle(displayMode: MapDisplayMode): string | null {
  return displayMode === "topographic" ? "Case" : null;
}

export function buildCaseHoverRows(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
): CaseHoverRow[] {
  if (!properties) {
    return BLANK_CASE_ROW;
  }

  if (displayMode === "faction") {
    const rows = properties.faction
      ? [{ label: "Faction", value: properties.faction }]
      : [];

    const hoverRows = appendControlTypeRow(rows, properties);

    return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
  }

  if (displayMode === "influence") {
    const rows = properties.controleur
      ? [{ label: "Controleur", value: properties.controleur }]
      : properties.faction
        ? [{ label: "Faction", value: properties.faction }]
        : [];

    const hoverRows = appendControlTypeRow(rows, properties);

    return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
  }

  const rows = [
    properties.terrain_type
      ? { label: "Terrain", value: properties.terrain_type }
      : null,
    properties.colline ? { label: "Attribut", value: "Colline" } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const hoverRows = appendControlTypeRow(rows, properties);

  return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
}
