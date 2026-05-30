export const MAP_OBJECT_STATUSES = ["draft", "published", "archived"] as const;
export type MapObjectStatus = (typeof MAP_OBJECT_STATUSES)[number];
export const MAP_ROUTE_GEOMETRY_MODES = ["straight", "curved"] as const;
export type MapRouteGeometryMode = (typeof MAP_ROUTE_GEOMETRY_MODES)[number];

export const MAP_ROUTE_STROKE_STYLES = ["solid", "dashed", "dotted"] as const;
export type MapRouteStrokeStyle = (typeof MAP_ROUTE_STROKE_STYLES)[number];

export type EditorReferenceOption = {
  value: string;
  label: string;
  image_path?: string | null;
  image_alt?: string | null;
  default_icon_key?: string | null;
  category?: string | null;
};

export type EditorMapLocality = {
  id_locality: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  depends_on_locality_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type EditorMapLandmark = {
  id_landmark: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type EditorMapForce = {
  id_force: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type EditorMapRoutePoint = [number, number];

export type EditorMapRoute = {
  id_route: string;
  name: string;
  route_type: string;
  points: EditorMapRoutePoint[];
  geometry_mode: MapRouteGeometryMode;
  stroke_style: MapRouteStrokeStyle;
  stroke_width: number;
  stroke_color: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type EditorMapLocalityInput = {
  id_locality?: string;
  name: string;
  type_key: string;
  icon_key?: string | null;
  x: number;
  y: number;
  id_case_detected?: string | null;
  faction?: string | null;
  controleur?: string | null;
  status?: MapObjectStatus;
  depends_on_locality_id?: string | null;
  description?: string | null;
};

export type EditorMapLandmarkInput = {
  id_landmark?: string;
  name: string;
  type_key: string;
  icon_key?: string | null;
  x: number;
  y: number;
  id_case_detected?: string | null;
  faction?: string | null;
  controleur?: string | null;
  status?: MapObjectStatus;
  description?: string | null;
};

export type EditorMapForceInput = {
  id_force?: string;
  name: string;
  type_key: string;
  icon_key?: string | null;
  x: number;
  y: number;
  id_case_detected?: string | null;
  faction?: string | null;
  controleur?: string | null;
  status?: MapObjectStatus;
  description?: string | null;
};

export type EditorMapRouteInput = {
  id_route?: string;
  name: string;
  route_type: string;
  points: EditorMapRoutePoint[];
  geometry_mode?: MapRouteGeometryMode;
  stroke_style?: MapRouteStrokeStyle;
  stroke_width?: number;
  stroke_color?: string | null;
  faction?: string | null;
  controleur?: string | null;
  status?: MapObjectStatus;
  description?: string | null;
};

export type EditorMapLocalityPatch = Partial<
  Omit<EditorMapLocalityInput, "id_locality">
>;

export type EditorMapLandmarkPatch = Partial<
  Omit<EditorMapLandmarkInput, "id_landmark">
>;

export type EditorMapForcePatch = Partial<
  Omit<EditorMapForceInput, "id_force">
>;

export type EditorMapRoutePatch = Partial<
  Omit<EditorMapRouteInput, "id_route">
>;

export type EditorListOptions = {
  status?: string | null;
  type_key?: string | null;
  faction?: string | null;
  controleur?: string | null;
  search?: string | null;
  limit?: number | null;
};

export type EditorReferenceData = {
  locality_types: EditorReferenceOption[];
  landmark_types: EditorReferenceOption[];
  force_types: EditorReferenceOption[];
  map_icons: EditorReferenceOption[];
  factions: EditorReferenceOption[];
  controleurs: EditorReferenceOption[];
};
