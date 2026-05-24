export type StableCaseProperties = {
  registry_id_case?: string | null;
  id_case: string;
  region?: string | null;
  sous_region?: string | null;
  cote?: boolean | null;
  lac_majeur?: boolean | null;
  cours_eau_majeur?: boolean | null;
  terrain_cat?: string | null;
  terrain_type?: string | null;
  relief?: string | null;
  faction?: string | null;
  controleur?: string | null;
  controle_type?: string | null;
};

export type MapStyleTargetType =
  | "faction"
  | "controleur"
  | "terrain_type"
  | "relief";

export const MAP_PATTERN_TYPES = [
  "diagonal",
  "diagonal_reverse",
  "crosshatch",
  "horizontal",
  "vertical",
  "dots",
  "grid",
] as const;

export type MapPatternType = (typeof MAP_PATTERN_TYPES)[number];

export type MapDisplayMode = "neutral" | "political" | "topographic";

export type MapStyleRecord = {
  target_type: MapStyleTargetType;
  target_id: string;
  fill: string | null;
  stroke: string | null;
  pattern_type: MapPatternType | null;
  pattern_color: string | null;
};

export type PublicMapStyles = Record<MapStyleTargetType, Record<string, MapStyleRecord>>;

export function createEmptyPublicMapStyles(): PublicMapStyles {
  return {
    faction: {},
    controleur: {},
    terrain_type: {},
    relief: {},
  };
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(normalized)) {
    return normalized;
  }

  return null;
}

export function normalizePatternType(value: unknown): MapPatternType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if ((MAP_PATTERN_TYPES as readonly string[]).includes(normalized)) {
    return normalized as MapPatternType;
  }

  return null;
}

export type StableCaseGeometry =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

export type StableCaseFeature = {
  type: "Feature";
  properties: StableCaseProperties;
  geometry: StableCaseGeometry;
};

export type StableCaseFeatureCollection = {
  type: "FeatureCollection";
  features: StableCaseFeature[];
};

export type CaseSelectionIntent = "replace" | "toggle";

export const CASES_DATA_URL = "/data/cases.geojson";

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNullableBoolean(value: unknown): value is boolean | null | undefined {
  return value === undefined || value === null || typeof value === "boolean";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isStableCaseProperties(value: unknown): value is StableCaseProperties {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isNullableString(value.registry_id_case) &&
    typeof value.id_case === "string" &&
    value.id_case.trim().length > 0 &&
    isNullableString(value.region) &&
    isNullableString(value.sous_region) &&
    isNullableBoolean(value.cote) &&
    isNullableBoolean(value.lac_majeur) &&
    isNullableBoolean(value.cours_eau_majeur) &&
    isNullableString(value.terrain_cat) &&
    isNullableString(value.terrain_type) &&
    isNullableString(value.relief) &&
    isNullableString(value.faction) &&
    isNullableString(value.controleur) &&
    isNullableString(value.controle_type)
  );
}

export function isStableCaseFeatureCollection(
  value: unknown,
): value is StableCaseFeatureCollection {
  if (!isPlainObject(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    return false;
  }

  return value.features.every((feature) => {
    if (!isPlainObject(feature) || feature.type !== "Feature") {
      return false;
    }

    if (!isStableCaseProperties(feature.properties)) {
      return false;
    }

    if (!isPlainObject(feature.geometry)) {
      return false;
    }

    return (
      (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") &&
      Array.isArray(feature.geometry.coordinates)
    );
  });
}

export function toStableCaseProperties(
  value: Record<string, unknown> | undefined,
): StableCaseProperties | null {
  if (!value || !isStableCaseProperties(value)) {
    return null;
  }

  return {
    registry_id_case:
      typeof value.registry_id_case === "string" && value.registry_id_case.trim().length > 0
        ? value.registry_id_case
        : value.id_case,
    id_case: value.id_case,
    region: value.region ?? null,
    sous_region: value.sous_region ?? null,
    cote: value.cote ?? null,
    lac_majeur: value.lac_majeur ?? null,
    cours_eau_majeur: value.cours_eau_majeur ?? null,
    terrain_cat: value.terrain_cat ?? null,
    terrain_type: value.terrain_type ?? null,
    relief: value.relief ?? null,
    faction: value.faction ?? null,
    controleur: value.controleur ?? null,
    controle_type: value.controle_type ?? null,
  };
}
