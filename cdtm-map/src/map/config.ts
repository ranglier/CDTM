export const MAP_BACKGROUND_PATH = "/maps/CTM.png";
export const MAP_DEFAULT_TILE_PATH_TEMPLATE =
  "/maps/tiles/ctm/{z}/{x}/{y}.webp";
export const MAP_PROJECTION_CODE = "CDTM-LOCAL";
export const MAP_EXTENT: [number, number, number, number] = [0, -4000, 3200, 0];
export const MAP_BACKGROUND_WIDTH = 3200;
export const MAP_BACKGROUND_HEIGHT = 4000;
export const MAP_TILE_SIZE = 256;
export const MAP_TILE_MIN_ZOOM = 0;
export const MAP_TILE_MAX_ZOOM = 4;
export const MAP_TILE_WEBP_QUALITY = 85;
export const MAP_TILE_RESOLUTIONS = [16, 8, 4, 2, 1] as const;
export const CASES_EXTENT: [number, number, number, number] = [
  81, -2204, 3100, -259,
];
export const MAP_FIT_PADDING: [number, number, number, number] = [
  48, 48, 48, 48,
];
export const MAP_MAX_ZOOM = 6;
export const MAP_CASES_RENDER_BUFFER = 512;
export const MAP_ROUTES_RENDER_BUFFER = 512;
export const MAP_POINTS_RENDER_BUFFER = 384;
export const MAP_VECTOR_UPDATE_WHILE_INTERACTING = false;
export const MAP_VECTOR_UPDATE_WHILE_ANIMATING = false;
export const MAP_CASE_PATTERNS_MAX_RESOLUTION = 2.25;
export const MAP_CASE_PATTERNS_MAX_VISIBLE_FEATURES = 650;
export const MAP_CASE_PATTERNS_INTERACTION_MAX_RESOLUTION = 1.6;
export const MAP_CASE_PATTERNS_INTERACTION_MAX_VISIBLE_FEATURES = 260;
export const MAP_CASE_TILE_PRELOAD_LEVELS = 4;
export const MAP_CASE_TILE_CACHE_SIZE = 1024;
export const MAP_CASE_TILE_TRANSITION_MS = 120;
export const MAP_CASE_TILE_PREFETCH_MARGIN = 1;
export const MAP_CASE_TILE_BACKUP_MAX_ZOOM = 2;
export const MAP_CASE_TILE_BACKUP_HIDE_DELAY_MS = 650;
export const MAP_CASE_TILE_BACKUP_IDLE_OPACITY = 0.001;
export const MAP_CASE_TILE_BACKUP_ACTIVE_OPACITY = 1;
export const MAP_CASE_TILE_BACKUP_ENABLED_ON_MOBILE = false;
export const MAP_PUBLIC_OBJECT_LOD_RESOLUTION = 4;
export const MAP_PUBLIC_ROUTE_LOD_RESOLUTION = 4;
export const MAP_PUBLIC_MOBILE_LOD_BONUS = 1.5;
