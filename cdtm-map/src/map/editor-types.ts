export const MAP_OBJECT_FAMILIES = ["locality", "landmark", "force"] as const;
export type MapObjectFamily = (typeof MAP_OBJECT_FAMILIES)[number];

export const MAP_OBJECT_STATUSES = ["draft", "published", "archived"] as const;
export type MapObjectStatus = (typeof MAP_OBJECT_STATUSES)[number];

export type MapIcon = {
  icon_key: string;
  label: string;
  license: string;
  category: string | null;
  image_path: string | null;
  image_original_name: string | null;
  image_mime_type: string | null;
  image_size_bytes: number | null;
  image_alt: string | null;
  is_active: boolean;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type MapPointType = {
  type_key: string;
  object_family: MapObjectFamily;
  label: string;
  description: string | null;
  default_icon_key: string | null;
  consumes_slot: boolean;
  slot_weight: number;
  is_active: boolean;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type MapPoint = {
  id_point: string;
  name: string;
  object_family: MapObjectFamily;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  depends_on_point_id: string | null;
  description: string | null;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type MapRoutePoint = {
  x: number;
  y: number;
};

export type MapRoute = {
  id_route: string;
  name: string;
  route_type: string;
  points_json: MapRoutePoint[];
  status: MapObjectStatus;
  faction: string | null;
  controleur: string | null;
  description: string | null;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Race = {
  race_key: string;
  label: string;
  description: string | null;
  is_active: boolean;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Peuple = {
  peuple_key: string;
  race_key: string;
  label: string;
  description: string | null;
  is_active: boolean;
  updated_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};
