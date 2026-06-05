import crypto from "node:crypto";

import {
  CASE_TILE_DISPLAY_MODES,
  type CaseTileDisplayMode,
} from "@/map/case-tiles";
import {
  createLegacyMapCompositeTileManifest,
  getExpectedMapCompositeTileCount,
  isMapCompositeTileProfile,
  MAP_COMPOSITE_TILE_PROFILES,
  type MapCompositeTileAdminStatus,
  type MapCompositeTileProfile,
  type MapCompositeTileProfileAdminStatus,
  type MapCompositeTileSetAdminRecord,
  type PublicMapCompositeTileManifest,
} from "@/map/composite-tiles";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "@/map/config";
import { ensureDatabaseReady, getPool } from "@/server/db";
import {
  assertCompleteMapCompositeTiles,
  computeMapCompositeTileState,
  generateMapCompositeTiles,
  getMapCompositeTileSetTilesDir,
  getMapCompositeTileSetTilesPublicPath,
  getMapCompositeTileUrlTemplate,
} from "@/server/map-composite-tiling";
import {
  getMapCaseTileSetTilesDir,
  readMapCasePickingIndex,
} from "@/server/map-case-tiling";

type MapCompositeTileSetRow = {
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
  resolutions_json: unknown;
  generation_status: "generating" | "ready" | "failed";
  generation_error: string | null;
  is_active: boolean;
  created_at: Date | string;
  generated_at: Date | string | null;
  updated_by_user_id: number | null;
  updated_by_username?: string | null;
};

function toIsoStringOrNull(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function normalizeResolutions(value: unknown): number[] {
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return value;
  }

  return [...MAP_TILE_RESOLUTIONS];
}

function normalizeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Generation des tuiles composees impossible.";

  return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
}

function toMapCompositeTileSetAdminRecord(
  row: MapCompositeTileSetRow,
): MapCompositeTileSetAdminRecord {
  return {
    id_tile_set: row.id_tile_set,
    profile: row.profile,
    state_hash: row.state_hash,
    background_id: row.background_id,
    case_tile_set_id: row.case_tile_set_id,
    background_hash: row.background_hash,
    case_tile_hash: row.case_tile_hash,
    tiles_path: row.tiles_path,
    tile_size: row.tile_size,
    min_zoom: row.min_zoom,
    max_zoom: row.max_zoom,
    resolutions_json: normalizeResolutions(row.resolutions_json),
    generation_status: row.generation_status,
    generation_error: row.generation_error,
    is_active: row.is_active,
    created_at: new Date(row.created_at).toISOString(),
    generated_at: toIsoStringOrNull(row.generated_at),
    updated_by_user_id: row.updated_by_user_id,
    updated_by_username: row.updated_by_username ?? null,
  };
}

async function computeCurrentStateHashSafe(
  profile: MapCompositeTileProfile,
): Promise<string | null> {
  try {
    return (await computeMapCompositeTileState(profile)).stateHash;
  } catch (error) {
    console.error("Calcul du hash des tuiles composees impossible.", error);
    return null;
  }
}

async function selectActiveReadyMapCompositeTileSet(
  profile: MapCompositeTileProfile,
): Promise<MapCompositeTileSetRow | null> {
  const result = await getPool().query<MapCompositeTileSetRow>(
    `
      SELECT *
      FROM map_composite_tile_sets
      WHERE profile = $1
        AND is_active = TRUE
        AND generation_status = 'ready'
      ORDER BY generated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [profile],
  );

  return result.rows[0] ?? null;
}

async function listMapCompositeTileSetRows(
  profile: MapCompositeTileProfile | null = null,
  limit = 40,
): Promise<MapCompositeTileSetRow[]> {
  const params: unknown[] = [];
  const profileWhere = profile
    ? (() => {
        params.push(profile);
        return "WHERE tile_set.profile = $1";
      })()
    : "";

  params.push(limit);

  const result = await getPool().query<MapCompositeTileSetRow>(
    `
      SELECT
        tile_set.*,
        staff_users.username AS updated_by_username
      FROM map_composite_tile_sets AS tile_set
      LEFT JOIN staff_users ON staff_users.id = tile_set.updated_by_user_id
      ${profileWhere}
      ORDER BY tile_set.profile ASC, tile_set.is_active DESC, tile_set.created_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows;
}

async function toPublicManifest(
  row: MapCompositeTileSetRow,
  currentStateHash: string | null,
): Promise<PublicMapCompositeTileManifest> {
  const templates = Object.fromEntries(
    CASE_TILE_DISPLAY_MODES.map((mode) => [
      mode,
      getMapCompositeTileUrlTemplate({
        tilesPath: row.tiles_path,
        profile: row.profile,
        mode,
      }),
    ]),
  ) as Record<CaseTileDisplayMode, string>;
  const picking = await readMapCasePickingIndex(
    getMapCaseTileSetTilesDir(row.case_tile_set_id),
  );

  return {
    mode: "composite",
    source: "generated",
    profile: row.profile,
    id: row.id_tile_set,
    tileSize: row.tile_size,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    resolutions: normalizeResolutions(row.resolutions_json),
    extent: MAP_EXTENT,
    stateHash: row.state_hash,
    currentStateHash,
    stale: currentStateHash ? row.state_hash !== currentStateHash : true,
    generatedAt: toIsoStringOrNull(row.generated_at),
    tileUrlTemplates: templates,
    picking,
  };
}

export async function getPublicMapCompositeTileManifest(
  profile: MapCompositeTileProfile,
): Promise<PublicMapCompositeTileManifest> {
  if (!isMapCompositeTileProfile(profile)) {
    return createLegacyMapCompositeTileManifest("mobile");
  }

  const hasDatabase = await ensureDatabaseReady();
  const currentStateHashPromise = computeCurrentStateHashSafe(profile);

  if (!hasDatabase) {
    return createLegacyMapCompositeTileManifest(
      profile,
      await currentStateHashPromise,
    );
  }

  const activeTileSet = await selectActiveReadyMapCompositeTileSet(profile);
  const currentStateHash = await currentStateHashPromise;

  return activeTileSet
    ? await toPublicManifest(activeTileSet, currentStateHash)
    : createLegacyMapCompositeTileManifest(profile, currentStateHash);
}

async function getProfileAdminStatus(
  profile: MapCompositeTileProfile,
  rows: MapCompositeTileSetRow[],
): Promise<MapCompositeTileProfileAdminStatus> {
  const records = rows
    .filter((row) => row.profile === profile)
    .map(toMapCompositeTileSetAdminRecord);
  const active = records.find((record) => record.is_active) ?? null;
  const currentStateHash = await computeCurrentStateHashSafe(profile);

  return {
    profile,
    active,
    latest: records,
    current_state_hash: currentStateHash,
    stale: Boolean(active && currentStateHash && active.state_hash !== currentStateHash),
    fallback: active === null,
    expected_tile_count: getExpectedMapCompositeTileCount(),
  };
}

export async function getMapCompositeTileAdminStatus(): Promise<MapCompositeTileAdminStatus> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const rows = await listMapCompositeTileSetRows();
  const profileEntries = await Promise.all(
    MAP_COMPOSITE_TILE_PROFILES.map(async (profile) => [
      profile,
      await getProfileAdminStatus(profile, rows),
    ] as const),
  );

  return {
    profiles: Object.fromEntries(profileEntries) as Record<
      MapCompositeTileProfile,
      MapCompositeTileProfileAdminStatus
    >,
    expected_tile_count: getExpectedMapCompositeTileCount(),
  };
}

async function markMapCompositeTileSetFailed(
  idTileSet: string,
  error: unknown,
): Promise<void> {
  await getPool().query(
    `
      UPDATE map_composite_tile_sets
      SET
        generation_status = 'failed',
        generation_error = $2,
        is_active = FALSE,
        updated_at = NOW()
      WHERE id_tile_set = $1
    `,
    [idTileSet, normalizeErrorMessage(error)],
  );
}

export async function regenerateMapCompositeTiles({
  profile,
  userId,
}: {
  profile: MapCompositeTileProfile;
  userId: number;
}): Promise<MapCompositeTileAdminStatus> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  if (!isMapCompositeTileProfile(profile)) {
    throw new Error("Profil de tuiles composees invalide.");
  }

  const state = await computeMapCompositeTileState(profile);
  const idTileSet = crypto.randomUUID();
  const tilesPublicPath = getMapCompositeTileSetTilesPublicPath(idTileSet);
  const tilesDir = getMapCompositeTileSetTilesDir(idTileSet);

  await getPool().query(
    `
      INSERT INTO map_composite_tile_sets (
        id_tile_set,
        profile,
        state_hash,
        background_id,
        case_tile_set_id,
        background_hash,
        case_tile_hash,
        tiles_path,
        tile_size,
        min_zoom,
        max_zoom,
        resolutions_json,
        generation_status,
        is_active,
        updated_by_user_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12::jsonb, 'generating', FALSE, $13
      )
    `,
    [
      idTileSet,
      profile,
      state.stateHash,
      state.backgroundManifest.id,
      state.caseTileManifest.id,
      state.backgroundHash,
      state.caseTileHash,
      tilesPublicPath,
      MAP_TILE_SIZE,
      MAP_TILE_MIN_ZOOM,
      MAP_TILE_MAX_ZOOM,
      JSON.stringify(MAP_TILE_RESOLUTIONS),
      userId,
    ],
  );

  try {
    await generateMapCompositeTiles({ state, outputDir: tilesDir });
    await assertCompleteMapCompositeTiles({ tilesDir, profile });

    const client = await getPool().connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE map_composite_tile_sets
          SET
            is_active = FALSE,
            updated_at = NOW()
          WHERE profile = $1
            AND is_active = TRUE
        `,
        [profile],
      );
      await client.query(
        `
          UPDATE map_composite_tile_sets
          SET
            generation_status = 'ready',
            generation_error = NULL,
            is_active = TRUE,
            generated_at = NOW(),
            updated_at = NOW(),
            updated_by_user_id = $2
          WHERE id_tile_set = $1
        `,
        [idTileSet, userId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await markMapCompositeTileSetFailed(idTileSet, error);
    throw error;
  }

  return getMapCompositeTileAdminStatus();
}
