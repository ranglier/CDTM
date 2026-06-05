import {
  CASE_TILE_DISPLAY_MODES,
  getExpectedMapCaseDisplayTileCount,
  type CaseTileDisplayMode,
  type MapCasePickingManifest,
} from "./case-tiles.ts";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "./config.ts";

export const MAP_COMPOSITE_TILE_PROFILES = ["mobile", "desktop"] as const;

export type MapCompositeTileProfile =
  (typeof MAP_COMPOSITE_TILE_PROFILES)[number];

export type MapCompositeTileGenerationStatus =
  | "generating"
  | "ready"
  | "failed";

export type PublicMapCompositeTileManifest =
  | {
      mode: "legacy";
      source: "fallback";
      profile: MapCompositeTileProfile;
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
      picking: MapCasePickingManifest | null;
    }
  | {
      mode: "composite";
      source: "generated";
      profile: MapCompositeTileProfile;
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
      picking: MapCasePickingManifest | null;
    };

export type MapCompositeTileSetAdminRecord = {
  id_tile_set: string;
  profile: MapCompositeTileProfile;
  state_hash: string;
  background_id: string;
  case_tile_set_id: string;
  background_hash: string;
  case_tile_hash: string;
  tiles_path: string;
  tile_size: number;
  min_zoom: number;
  max_zoom: number;
  resolutions_json: number[];
  generation_status: MapCompositeTileGenerationStatus;
  generation_error: string | null;
  is_active: boolean;
  created_at: string;
  generated_at: string | null;
  updated_by_user_id: number | null;
  updated_by_username?: string | null;
};

export type MapCompositeTileProfileAdminStatus = {
  profile: MapCompositeTileProfile;
  active: MapCompositeTileSetAdminRecord | null;
  latest: MapCompositeTileSetAdminRecord[];
  current_state_hash: string | null;
  stale: boolean;
  fallback: boolean;
  expected_tile_count: number;
};

export type MapCompositeTileAdminStatus = {
  profiles: Record<MapCompositeTileProfile, MapCompositeTileProfileAdminStatus>;
  expected_tile_count: number;
};

export function isMapCompositeTileProfile(
  value: unknown,
): value is MapCompositeTileProfile {
  return (
    typeof value === "string" &&
    (MAP_COMPOSITE_TILE_PROFILES as readonly string[]).includes(value)
  );
}

export function createLegacyMapCompositeTileManifest(
  profile: MapCompositeTileProfile,
  currentStateHash: string | null = null,
  picking: MapCasePickingManifest | null = null,
): PublicMapCompositeTileManifest {
  return {
    mode: "legacy",
    source: "fallback",
    profile,
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
    picking,
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

function isCasePickingManifest(value: unknown): value is MapCasePickingManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.tileUrlTemplate === "string" &&
    candidate.tileUrlTemplate.trim().length > 0 &&
    Array.isArray(candidate.idByValue) &&
    candidate.idByValue.every(
      (idCase) => typeof idCase === "string" && idCase.trim().length > 0,
    )
  );
}

export function normalizePublicMapCompositeTileManifest(
  value: unknown,
): PublicMapCompositeTileManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublicMapCompositeTileManifest>;

  if (
    !isMapCompositeTileProfile(candidate.profile) ||
    typeof candidate.tileSize !== "number" ||
    typeof candidate.minZoom !== "number" ||
    typeof candidate.maxZoom !== "number" ||
    !isFiniteNumberArray(candidate.resolutions) ||
    !isExtent(candidate.extent) ||
    typeof candidate.stale !== "boolean"
  ) {
    return null;
  }

  const picking = isCasePickingManifest(candidate.picking)
    ? {
        tileUrlTemplate: candidate.picking.tileUrlTemplate,
        idByValue: candidate.picking.idByValue,
      }
    : null;

  if (candidate.mode === "legacy") {
    return {
      mode: "legacy",
      source: "fallback",
      profile: candidate.profile,
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
      picking,
    };
  }

  if (
    candidate.mode !== "composite" ||
    candidate.source !== "generated" ||
    typeof candidate.id !== "string" ||
    typeof candidate.stateHash !== "string" ||
    !isTileTemplateMap(candidate.tileUrlTemplates)
  ) {
    return null;
  }

  return {
    mode: "composite",
    source: "generated",
    profile: candidate.profile,
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
    picking,
  };
}

export function getExpectedMapCompositeTileCount(): number {
  return getExpectedMapCaseDisplayTileCount();
}
