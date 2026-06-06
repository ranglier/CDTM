import type { MapDisplayMode, StableCaseProperties } from "@/map/types";

const BLANK_CASE_ROW = [{ label: "Etat", value: "Case vierge" }];

type CaseHoverRow = { label: string; value: string };
type ControlActorType = "faction" | "controleur";

export type CaseHoverReferenceLabels = {
  factions?: Record<string, string>;
  controleurs?: Record<string, string>;
};

function normalizeControlType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isVassalControlType(value: string | null): boolean {
  return value === "vassal" || value === "vassalite" || value === "vassalise";
}

function getReferenceActorLabel(
  actorType: ControlActorType,
  value: string | null | undefined,
  referenceLabels?: CaseHoverReferenceLabels,
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const labels =
    actorType === "faction"
      ? referenceLabels?.factions
      : referenceLabels?.controleurs;

  const directLabel = labels?.[trimmed]?.trim();

  if (directLabel) {
    return directLabel;
  }

  const normalizedValue = trimmed.toLowerCase();
  const insensitiveEntry = Object.entries(labels ?? {}).find(
    ([key]) => key.trim().toLowerCase() === normalizedValue,
  );
  const insensitiveLabel = insensitiveEntry?.[1]?.trim();

  return insensitiveLabel && insensitiveLabel.length > 0
    ? insensitiveLabel
    : null;
}

function getActorHoverValue(
  actorType: ControlActorType,
  value: string,
  referenceLabels?: CaseHoverReferenceLabels,
): string {
  return getReferenceActorLabel(actorType, value, referenceLabels) ?? value;
}

function formatCaseActor(
  value: string | null | undefined,
  actorType?: ControlActorType,
  referenceLabels?: CaseHoverReferenceLabels,
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (actorType) {
    const referenceLabel = getReferenceActorLabel(
      actorType,
      trimmed,
      referenceLabels,
    );

    if (referenceLabel) {
      return referenceLabel;
    }
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
  referenceLabels?: CaseHoverReferenceLabels,
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

  return actorType
    ? formatCaseActor(actorId, actorType, referenceLabels)
    : null;
}

function getCurrentControlActorLabel(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties,
  referenceLabels?: CaseHoverReferenceLabels,
): string | null {
  const faction = formatCaseActor(
    properties.faction,
    "faction",
    referenceLabels,
  );
  const controller = formatCaseActor(
    properties.controleur,
    "controleur",
    referenceLabels,
  );

  return displayMode === "faction"
    ? (faction ?? controller)
    : (controller ?? faction);
}

function getOtherCurrentControlActorLabel(
  properties: StableCaseProperties,
  primaryActor: string | null,
  referenceLabels?: CaseHoverReferenceLabels,
): string | null {
  const candidates = [
    formatCaseActor(properties.faction, "faction", referenceLabels),
    formatCaseActor(properties.controleur, "controleur", referenceLabels),
  ];

  return (
    candidates.find((candidate) => candidate && candidate !== primaryActor) ??
    null
  );
}

function buildControlTypeHoverRow(
  properties: StableCaseProperties,
  displayMode: MapDisplayMode,
  referenceLabels?: CaseHoverReferenceLabels,
): CaseHoverRow | null {
  const controlType = properties.controle_type?.trim();

  if (!controlType) {
    return null;
  }

  const normalizedControlType = normalizeControlType(controlType);

  if (normalizedControlType === "total" || normalizedControlType === "aucun") {
    return null;
  }

  if (displayMode === "faction" && isVassalControlType(normalizedControlType)) {
    return null;
  }

  const explicitPrimaryActor = getExplicitControlActorLabel(
    properties,
    "principal",
    referenceLabels,
  );
  const primaryActor =
    explicitPrimaryActor ??
    getCurrentControlActorLabel(displayMode, properties, referenceLabels);
  const explicitSecondaryActor = getExplicitControlActorLabel(
    properties,
    "secondaire",
    referenceLabels,
  );
  const fallbackSecondaryActor = getOtherCurrentControlActorLabel(
    properties,
    primaryActor,
    referenceLabels,
  );
  const controller = formatCaseActor(
    properties.controleur,
    "controleur",
    referenceLabels,
  );

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
  referenceLabels?: CaseHoverReferenceLabels,
): CaseHoverRow[] {
  const controlTypeRow = buildControlTypeHoverRow(
    properties,
    displayMode,
    referenceLabels,
  );

  return controlTypeRow ? [...rows, controlTypeRow] : rows;
}

export function getCaseHoverTitle(displayMode: MapDisplayMode): string | null {
  return displayMode === "topographic" ? "Case" : null;
}

export function buildCaseHoverRows(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
  referenceLabels?: CaseHoverReferenceLabels,
): CaseHoverRow[] {
  if (!properties) {
    return BLANK_CASE_ROW;
  }

  if (displayMode === "faction") {
    const rows: CaseHoverRow[] = [];

    if (properties.faction) {
      rows.push({
        label: "Faction",
        value: getActorHoverValue(
          "faction",
          properties.faction,
          referenceLabels,
        ),
      });
    } else if (properties.controleur) {
      rows.push({
        label: "Controleur",
        value: getActorHoverValue(
          "controleur",
          properties.controleur,
          referenceLabels,
        ),
      });
    }

    const hoverRows = appendControlTypeRow(
      rows,
      properties,
      displayMode,
      referenceLabels,
    );

    return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
  }

  if (displayMode === "influence") {
    const rows = properties.controleur
      ? [
          {
            label: "Controleur",
            value: getActorHoverValue(
              "controleur",
              properties.controleur,
              referenceLabels,
            ),
          },
        ]
      : properties.faction
        ? [
            {
              label: "Faction",
              value: getActorHoverValue(
                "faction",
                properties.faction,
                referenceLabels,
              ),
            },
          ]
        : [];

    const hoverRows = appendControlTypeRow(
      rows,
      properties,
      displayMode,
      referenceLabels,
    );

    return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
  }

  const rows = [
    properties.terrain_type
      ? { label: "Terrain", value: properties.terrain_type }
      : null,
    properties.colline ? { label: "Attribut", value: "Colline" } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const hoverRows = appendControlTypeRow(
    rows,
    properties,
    displayMode,
    referenceLabels,
  );

  return hoverRows.length > 0 ? hoverRows : BLANK_CASE_ROW;
}
