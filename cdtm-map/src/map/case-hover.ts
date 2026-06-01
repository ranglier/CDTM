import type { MapDisplayMode, StableCaseProperties } from "@/map/types";

const BLANK_CASE_ROW = [{ label: "Etat", value: "Case vierge" }];

type CaseHoverRow = { label: string; value: string };
type ControlActorType = "faction" | "controleur";

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

function normalizeControlActorType(
  value: string | null | undefined,
): ControlActorType | null {
  const normalized = value?.trim().toLowerCase();

  return normalized === "faction" || normalized === "controleur"
    ? normalized
    : null;
}

function getExplicitControlActorLabel(
  properties: StableCaseProperties,
  role: "principal" | "secondaire",
): string | null {
  const actorType = normalizeControlActorType(
    role === "principal"
      ? properties.controle_principal_type
      : properties.controle_secondaire_type,
  );
  const actorId =
    role === "principal"
      ? properties.controle_principal_id
      : properties.controle_secondaire_id;

  return actorType ? formatCaseActor(actorId) : null;
}

function getCurrentControlActorLabel(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties,
): string | null {
  const faction = formatCaseActor(properties.faction);
  const controller = formatCaseActor(properties.controleur);

  return displayMode === "faction"
    ? (faction ?? controller)
    : (controller ?? faction);
}

function getOtherCurrentControlActorLabel(
  properties: StableCaseProperties,
  primaryActor: string | null,
): string | null {
  const candidates = [
    formatCaseActor(properties.faction),
    formatCaseActor(properties.controleur),
  ];

  return (
    candidates.find((candidate) => candidate && candidate !== primaryActor) ??
    null
  );
}

function buildControlTypeHoverRow(
  properties: StableCaseProperties,
  displayMode: MapDisplayMode,
): CaseHoverRow | null {
  const controlType = properties.controle_type?.trim();

  if (!controlType) {
    return null;
  }

  const normalizedControlType = normalizeControlType(controlType);

  if (normalizedControlType === "total" || normalizedControlType === "aucun") {
    return null;
  }

  const explicitPrimaryActor = getExplicitControlActorLabel(
    properties,
    "principal",
  );
  const primaryActor =
    explicitPrimaryActor ??
    getCurrentControlActorLabel(displayMode, properties);
  const explicitSecondaryActor = getExplicitControlActorLabel(
    properties,
    "secondaire",
  );
  const fallbackSecondaryActor = getOtherCurrentControlActorLabel(
    properties,
    primaryActor,
  );
  const controller = formatCaseActor(properties.controleur);

  switch (normalizedControlType) {
    case "occupe":
    case "occupation": {
      const occupant =
        explicitSecondaryActor ??
        fallbackSecondaryActor ??
        (explicitPrimaryActor ? null : controller);

      return {
        label: "Controle",
        value: occupant ? `Occupe par ${occupant}` : "Occupe",
      };
    }
    case "vassal":
    case "vassalite":
    case "vassalise": {
      const suzerain =
        explicitSecondaryActor ??
        fallbackSecondaryActor ??
        (explicitPrimaryActor ? null : controller);

      return {
        label: "Controle",
        value: suzerain ? `Vassal de ${suzerain}` : "Vassalite",
      };
    }
    case "conteste": {
      const contender = explicitSecondaryActor ?? fallbackSecondaryActor;

      return {
        label: "Controle",
        value:
          primaryActor && contender && primaryActor !== contender
            ? `Conflit entre ${primaryActor} et ${contender}`
            : "Conflit",
      };
    }
    case "partiel":
      return {
        label: "Controle",
        value: primaryActor
          ? `Controle partiel de ${primaryActor}`
          : "Controle partiel",
      };
    default:
      return { label: "Controle", value: controlType };
  }
}

function appendControlTypeRow(
  rows: CaseHoverRow[],
  properties: StableCaseProperties,
  displayMode: MapDisplayMode,
): CaseHoverRow[] {
  const controlTypeRow = buildControlTypeHoverRow(properties, displayMode);

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

    const hoverRows = appendControlTypeRow(rows, properties, displayMode);

    return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
  }

  if (displayMode === "influence") {
    const rows = properties.controleur
      ? [{ label: "Controleur", value: properties.controleur }]
      : properties.faction
        ? [{ label: "Faction", value: properties.faction }]
        : [];

    const hoverRows = appendControlTypeRow(rows, properties, displayMode);

    return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
  }

  const rows = [
    properties.terrain_type
      ? { label: "Terrain", value: properties.terrain_type }
      : null,
    properties.colline ? { label: "Attribut", value: "Colline" } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const hoverRows = appendControlTypeRow(rows, properties, displayMode);

  return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
}
