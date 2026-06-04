import {
  MAP_BACKGROUND_HEIGHT,
  MAP_BACKGROUND_WIDTH,
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "@/map/config";
import type { MapDisplayMode } from "@/map/types";

export const CASE_TILE_DISPLAY_MODES = [
  "faction",
  "influence",
  "topographic",
] as const satisfies readonly MapDisplayMode[];

export type CaseTileDisplayMode = (typeof CASE_TILE_DISPLAY_MODES)[number];

export type MapCaseTileGenerationStatus = "generating" | "ready" | "failed";

export type PublicMapCaseTileManifest =
  | {
      mode: "vector";
      source: "fallback";
      id: null;
      tileSize: number;
      minZoom: number;
      maxZoom: number;
      resolutions: number[];
      extent: [number, number, number, number];
      stateHash: string | null;
      currentStateHash: string | null;
      stale: boolean;
      generatedAt: null;
      tileUrlTemplates: null;
    }
  | {
      mode: "raster";
      source: "generated";
      id: string;
      tileSize: number;
      minZoom: number;
      maxZoom: number;
      resolutions: number[];
      extent: [number, number, number, number];
      stateHash: string;
      currentStateHash: string | null;
      stale: boolean;
      generatedAt: string | null;
      tileUrlTemplates: Record<CaseTileDisplayMode, string>;
    };

export type MapCaseTileSetAdminRecord = {
  id_tile_set: string;
  state_hash: string;
  tiles_path: string;
  tile_size: number;
  min_zoom: number;
  max_zoom: number;
  resolutions_json: number[];
  generation_status: MapCaseTileGenerationStatus;
  generation_error: string | null;
  is_active: boolean;
  created_at: string;
  generated_at: string | null;
  updated_by_user_id: number | null;
  updated_by_username?: string | null;
};

export type MapCaseTileAdminStatus = {
  active: MapCaseTileSetAdminRecord | null;
  latest: MapCaseTileSetAdminRecord[];
  current_state_hash: string | null;
  stale: boolean;
  fallback: boolean;
  expected_tile_count: number;
};

export function createVectorFallbackMapCaseTileManifest(
  currentStateHash: string | null = null,
): PublicMapCaseTileManifest {
  return {
    mode: "vector",
    source: "fallback",
    id: null,
    tileSize: MAP_TILE_SIZE,
    minZoom: MAP_TILE_MIN_ZOOM,
    maxZoom: MAP_TILE_MAX_ZOOM,
    resolutions: [...MAP_TILE_RESOLUTIONS],
    extent: MAP_EXTENT,
    stateHash: null,
    currentStateHash,
    stale: false,
    generatedAt: null,
    tileUrlTemplates: null,
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

function isTileTemplateMap(
  value: unknown,
): value is Record<CaseTileDisplayMode, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return CASE_TILE_DISPLAY_MODES.every(
    (mode) =>
      typeof candidate[mode] === "string" &&
      candidate[mode].trim().length > 0,
  );
}

export function normalizePublicMapCaseTileManifest(
  value: unknown,
): PublicMapCaseTileManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublicMapCaseTileManifest>;

  if (
    typeof candidate.tileSize !== "number" ||
    typeof candidate.minZoom !== "number" ||
    typeof candidate.maxZoom !== "number" ||
    !isFiniteNumberArray(candidate.resolutions) ||
    !isExtent(candidate.extent) ||
    typeof candidate.stale !== "boolean"
  ) {
    return null;
  }

  if (candidate.mode === "vector") {
    return {
      mode: "vector",
      source: "fallback",
      id: null,
      tileSize: candidate.tileSize,
      minZoom: candidate.minZoom,
      maxZoom: candidate.maxZoom,
      resolutions: candidate.resolutions,
      extent: candidate.extent,
      stateHash:
        typeof candidate.stateHash === "string" ? candidate.stateHash : null,
      currentStateHash:
        typeof candidate.currentStateHash === "string"
          ? candidate.currentStateHash
          : null,
      stale: false,
      generatedAt: null,
      tileUrlTemplates: null,
    };
  }

  if (
    candidate.mode !== "raster" ||
    candidate.source !== "generated" ||
    typeof candidate.id !== "string" ||
    typeof candidate.stateHash !== "string" ||
    !isTileTemplateMap(candidate.tileUrlTemplates)
  ) {
    return null;
  }

  return {
    mode: "raster",
    source: "generated",
    id: candidate.id,
    tileSize: candidate.tileSize,
    minZoom: candidate.minZoom,
    maxZoom: candidate.maxZoom,
    resolutions: candidate.resolutions,
    extent: candidate.extent,
    stateHash: candidate.stateHash,
    currentStateHash:
      typeof candidate.currentStateHash === "string"
        ? candidate.currentStateHash
        : null,
    stale: candidate.stale,
    generatedAt:
      typeof candidate.generatedAt === "string" ? candidate.generatedAt : null,
    tileUrlTemplates: {
      faction: candidate.tileUrlTemplates.faction,
      influence: candidate.tileUrlTemplates.influence,
      topographic: candidate.tileUrlTemplates.topographic,
    },
  };
}

export function getMapCaseTilePlan() {
  return MAP_TILE_RESOLUTIONS.map((resolution, index) => {
    const z = index + MAP_TILE_MIN_ZOOM;
    const width = Math.ceil(MAP_BACKGROUND_WIDTH / resolution);
    const height = Math.ceil(MAP_BACKGROUND_HEIGHT / resolution);
    const columns = Math.ceil(width / MAP_TILE_SIZE);
    const rows = Math.ceil(height / MAP_TILE_SIZE);

    return {
      z,
      resolution,
      width,
      height,
      columns,
      rows,
      tileCount: columns * rows,
    };
  });
}

export function getExpectedMapCaseTileCount(): number {
  return (
    CASE_TILE_DISPLAY_MODES.length *
    getMapCaseTilePlan().reduce((sum, level) => sum + level.tileCount, 0)
  );
}
