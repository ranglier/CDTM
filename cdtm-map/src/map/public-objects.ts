import type {
  EditorMapLandmark,
  EditorMapLocality,
  EditorMapRoute,
  MapRouteGeometryMode,
  MapRouteStrokeStyle,
} from "@/editor/types";

export type PublicMapReferenceIcon = {
  value: string;
  label: string;
  image_path: string | null;
  image_alt: string | null;
};

export type PublicMapReferenceLocalityType = {
  value: string;
  label: string;
  default_icon_key: string | null;
};

export type PublicMapReferenceLandmarkType = {
  value: string;
  label: string;
  category: "landmark" | "unique" | null;
  default_icon_key: string | null;
};

export type PublicMapObjectReferenceData = {
  map_icons: PublicMapReferenceIcon[];
  locality_types: PublicMapReferenceLocalityType[];
  landmark_types: PublicMapReferenceLandmarkType[];
};

export type PublicMapLocality = {
  id: string;
  name: string;
  type_key: string;
  type_label?: string | null;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  description: string | null;
};

export type PublicMapLandmark = {
  id: string;
  name: string;
  type_key: string;
  type_label?: string | null;
  category: "landmark" | "unique" | null;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  description: string | null;
};

export type PublicMapRoute = {
  id: string;
  name: string;
  route_type: string;
  points: Array<[number, number]>;
  geometry_mode: MapRouteGeometryMode;
  stroke_style: MapRouteStrokeStyle;
  stroke_width: number;
  stroke_color: string | null;
  description: string | null;
};

export type PublicMapObjectsResponse = {
  localities: PublicMapLocality[];
  landmarks: PublicMapLandmark[];
  routes: PublicMapRoute[];
  reference: PublicMapObjectReferenceData;
};

export function createEmptyPublicMapObjectsResponse(): PublicMapObjectsResponse {
  return {
    localities: [],
    landmarks: [],
    routes: [],
    reference: {
      map_icons: [],
      locality_types: [],
      landmark_types: [],
    },
  };
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function shortenDescription(value: string | null | undefined): string | null {
  const description = normalizeDescription(value);

  if (!description) {
    return null;
  }

  if (description.length <= 120) {
    return description;
  }

  return `${description.slice(0, 117).trimEnd()}...`;
}

export function toRenderablePublicLocalities(
  localities: PublicMapLocality[],
): EditorMapLocality[] {
  return localities.map((locality) => ({
    id_locality: locality.id,
    name: locality.name,
    type_key: locality.type_key,
    icon_key: locality.icon_key,
    x: locality.x,
    y: locality.y,
    id_case_detected: locality.id_case_detected,
    faction: null,
    controleur: null,
    status: "published",
    depends_on_locality_id: null,
    description: locality.description,
    created_at: "",
    updated_at: "",
  }));
}

export function toRenderablePublicLandmarks(
  landmarks: PublicMapLandmark[],
): EditorMapLandmark[] {
  return landmarks.map((landmark) => ({
    id_landmark: landmark.id,
    name: landmark.name,
    type_key: landmark.type_key,
    icon_key: landmark.icon_key,
    x: landmark.x,
    y: landmark.y,
    id_case_detected: landmark.id_case_detected,
    faction: null,
    controleur: null,
    status: "published",
    description: landmark.description,
    created_at: "",
    updated_at: "",
  }));
}

export function toRenderablePublicRoutes(routes: PublicMapRoute[]): EditorMapRoute[] {
  return routes.map((route) => ({
    id_route: route.id,
    name: route.name,
    route_type: route.route_type,
    points: route.points,
    geometry_mode: route.geometry_mode,
    stroke_style: route.stroke_style,
    stroke_width: route.stroke_width,
    stroke_color: route.stroke_color,
    faction: null,
    controleur: null,
    status: "published",
    description: route.description,
    created_at: "",
    updated_at: "",
  }));
}

export function buildPublicLocalityHoverRows(
  locality: PublicMapLocality,
): Array<{ label: string; value: string }> {
  return [
    locality.type_label ? { label: "Type", value: locality.type_label } : null,
    locality.id_case_detected ? { label: "Case", value: locality.id_case_detected } : null,
    shortenDescription(locality.description)
      ? { label: "Description", value: shortenDescription(locality.description)! }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}

export function buildPublicLandmarkHoverRows(
  landmark: PublicMapLandmark,
): Array<{ label: string; value: string }> {
  return [
    landmark.type_label ? { label: "Type", value: landmark.type_label } : null,
    landmark.category
      ? {
          label: "Categorie",
          value: landmark.category === "unique" ? "Lieu unique" : "Landmark",
        }
      : null,
    landmark.id_case_detected ? { label: "Case", value: landmark.id_case_detected } : null,
    shortenDescription(landmark.description)
      ? { label: "Description", value: shortenDescription(landmark.description)! }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}

export function buildPublicRouteHoverRows(
  route: PublicMapRoute,
): Array<{ label: string; value: string }> {
  return [
    route.route_type ? { label: "Type", value: route.route_type } : null,
    shortenDescription(route.description)
      ? { label: "Description", value: shortenDescription(route.description)! }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}
