import {
  MAP_BACKGROUND_HEIGHT,
  MAP_BACKGROUND_PATH,
  MAP_BACKGROUND_WIDTH,
  MAP_DEFAULT_TILE_PATH_TEMPLATE,
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
  MAP_TILE_WEBP_QUALITY,
} from "@/map/config";

export type MapBackgroundGenerationStatus =
  | "generating"
  | "ready"
  | "failed";

export type PublicMapBackgroundManifest = {
  mode: "static" | "tiles";
  source: "default" | "uploaded";
  id: string;
  label: string;
  width: number;
  height: number;
  extent: [number, number, number, number];
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  resolutions: number[];
  webpQuality: number;
  imageUrl: string | null;
  tileUrlTemplate: string | null;
  activatedAt: string | null;
};

export type MapBackgroundAdminRecord = {
  id_background: string;
  label: string;
  source_path: string;
  tiles_path: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  tile_size: number;
  min_zoom: number;
  max_zoom: number;
  webp_quality: number;
  generation_status: MapBackgroundGenerationStatus;
  generation_error: string | null;
  is_active: boolean;
  created_at: string;
  generated_at: string | null;
  activated_at: string | null;
  updated_by_user_id: number | null;
  updated_by_username?: string | null;
};

export function createDefaultMapBackgroundManifest(
  mode: "static" | "tiles" = "tiles",
): PublicMapBackgroundManifest {
  return {
    mode,
    source: "default",
    id: "default",
    label: "Fond de carte par defaut",
    width: MAP_BACKGROUND_WIDTH,
    height: MAP_BACKGROUND_HEIGHT,
    extent: MAP_EXTENT,
    tileSize: MAP_TILE_SIZE,
    minZoom: MAP_TILE_MIN_ZOOM,
    maxZoom: MAP_TILE_MAX_ZOOM,
    resolutions: [...MAP_TILE_RESOLUTIONS],
    webpQuality: MAP_TILE_WEBP_QUALITY,
    imageUrl: MAP_BACKGROUND_PATH,
    tileUrlTemplate: mode === "tiles" ? MAP_DEFAULT_TILE_PATH_TEMPLATE : null,
    activatedAt: null,
  };
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function isExtent(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

export function normalizePublicMapBackgroundManifest(
  value: unknown,
): PublicMapBackgroundManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublicMapBackgroundManifest>;

  if (
    (candidate.mode !== "static" && candidate.mode !== "tiles") ||
    (candidate.source !== "default" && candidate.source !== "uploaded") ||
    typeof candidate.id !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number" ||
    !isExtent(candidate.extent) ||
    typeof candidate.tileSize !== "number" ||
    typeof candidate.minZoom !== "number" ||
    typeof candidate.maxZoom !== "number" ||
    !isFiniteNumberArray(candidate.resolutions) ||
    typeof candidate.webpQuality !== "number"
  ) {
    return null;
  }

  if (
    candidate.imageUrl !== null &&
    typeof candidate.imageUrl !== "string"
  ) {
    return null;
  }

  if (
    candidate.tileUrlTemplate !== null &&
    typeof candidate.tileUrlTemplate !== "string"
  ) {
    return null;
  }

  return {
    mode: candidate.mode,
    source: candidate.source,
    id: candidate.id,
    label: candidate.label,
    width: candidate.width,
    height: candidate.height,
    extent: candidate.extent,
    tileSize: candidate.tileSize,
    minZoom: candidate.minZoom,
    maxZoom: candidate.maxZoom,
    resolutions: candidate.resolutions,
    webpQuality: candidate.webpQuality,
    imageUrl: candidate.imageUrl,
    tileUrlTemplate: candidate.tileUrlTemplate,
    activatedAt:
      typeof candidate.activatedAt === "string"
        ? candidate.activatedAt
        : null,
  };
}
