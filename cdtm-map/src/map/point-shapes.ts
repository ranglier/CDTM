export type LocalityPointShape = "locality" | "fort" | "fortified_city";
export const MAP_OBJECT_POINT_SHAPES = [
  "circle",
  "square",
  "diamond",
  "star",
] as const;
export type MapObjectPointShape = (typeof MAP_OBJECT_POINT_SHAPES)[number];

export const MAP_OBJECT_POINT_SHAPE_LABELS: Record<
  MapObjectPointShape,
  string
> = {
  circle: "Rond",
  square: "Carre",
  diamond: "Losange",
  star: "Etoile",
};

function normalizeObjectTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveLocalityPointShape(typeKey: string): LocalityPointShape {
  const normalizedTypeKey = normalizeObjectTypeKey(typeKey);
  const isFortifiedSettlement =
    (normalizedTypeKey.includes("ville") ||
      normalizedTypeKey.includes("cite")) &&
    !normalizedTypeKey.includes("non_fortifie") &&
    !normalizedTypeKey.includes("non_fortified") &&
    !normalizedTypeKey.includes("unfortified") &&
    (normalizedTypeKey.includes("fortifie") ||
      normalizedTypeKey.includes("fortified") ||
      normalizedTypeKey.includes("forteresse"));

  if (isFortifiedSettlement) {
    return "fortified_city";
  }

  if (normalizedTypeKey === "fort") {
    return "fort";
  }

  return "locality";
}

export function isMapObjectPointShape(
  value: unknown,
): value is MapObjectPointShape {
  return MAP_OBJECT_POINT_SHAPES.includes(value as MapObjectPointShape);
}

export function normalizeMapObjectPointShape(
  value: unknown,
): MapObjectPointShape | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized === "auto") {
    return null;
  }

  return isMapObjectPointShape(normalized) ? normalized : null;
}

export function resolveDefaultLocalityRenderShape(
  typeKey: string,
): MapObjectPointShape {
  const shape = resolveLocalityPointShape(typeKey);

  if (shape === "fort") {
    return "square";
  }

  if (shape === "fortified_city") {
    return "star";
  }

  return "circle";
}
