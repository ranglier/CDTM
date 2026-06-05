import crypto from "node:crypto";
import { rm } from "node:fs/promises";

import {
  CASE_TILE_DISPLAY_MODES,
  createVectorFallbackMapCaseTileManifest,
  getExpectedMapCaseTileCount,
  type CaseTileDisplayMode,
  type MapCaseTileAdminStatus,
  type MapCaseTileSetAdminRecord,
  type PublicMapCaseTileManifest,
} from "@/map/case-tiles";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "@/map/config";
import { ensureDatabaseReady, getPool } from "@/server/db";
import {
  assertCompleteMapCaseTiles,
  computeMapCaseTileState,
  generateMapCaseTiles,
  getMapCaseTileSetDirectory,
  getMapCaseTileSetTilesDir,
  getMapCaseTileSetTilesPublicPath,
  getMapCaseTileUrlTemplate,
  readMapCasePickingIndex,
} from "@/server/map-case-tiling";

type MapCaseTileSetRow = {
  id_tile_set: string;
  state_hash: string;
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

const PUBLIC_STATE_HASH_CACHE_TTL_MS = 30_000;

let cachedPublicStateHash:
  | {
      value: string | null;
      expiresAt: number;
    }
  | null = null;
let pendingPublicStateHashPromise: Promise<string | null> | null = null;

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

function toMapCaseTileSetAdminRecord(
  row: MapCaseTileSetRow,
): MapCaseTileSetAdminRecord {
  return {
    id_tile_set: row.id_tile_set,
    state_hash: row.state_hash,
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

function normalizeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Generation des tuiles de cases impossible.";

  return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
}

async function toPublicManifest(
  row: MapCaseTileSetRow,
  currentStateHash: string | null,
): Promise<PublicMapCaseTileManifest> {
  const templates = Object.fromEntries(
    CASE_TILE_DISPLAY_MODES.map((mode) => [
      mode,
      getMapCaseTileUrlTemplate(row.tiles_path, mode),
    ]),
  ) as Record<CaseTileDisplayMode, string>;
  const picking = await readMapCasePickingIndex(
    getMapCaseTileSetTilesDir(row.id_tile_set),
  );

  return {
    mode: "raster",
    source: "generated",
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

async function computeCurrentStateHashSafe(): Promise<string | null> {
  try {
    return (await computeMapCaseTileState()).stateHash;
  } catch (error) {
    console.error("Calcul du hash des tuiles de cases impossible.", error);
    return null;
  }
}

async function getCachedPublicStateHash(): Promise<string | null> {
  const now = Date.now();

  if (cachedPublicStateHash && cachedPublicStateHash.expiresAt > now) {
    return cachedPublicStateHash.value;
  }

  if (!pendingPublicStateHashPromise) {
    pendingPublicStateHashPromise = computeCurrentStateHashSafe()
      .then((value) => {
        cachedPublicStateHash = {
          value,
          expiresAt: Date.now() + PUBLIC_STATE_HASH_CACHE_TTL_MS,
        };
        return value;
      })
      .finally(() => {
        pendingPublicStateHashPromise = null;
      });
  }

  return pendingPublicStateHashPromise;
}

async function selectActiveReadyMapCaseTileSet(): Promise<MapCaseTileSetRow | null> {
  const result = await getPool().query<MapCaseTileSetRow>(
    `
      SELECT *
      FROM map_case_tile_sets
      WHERE is_active = TRUE
        AND generation_status = 'ready'
      ORDER BY generated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
  );

  return result.rows[0] ?? null;
}

async function listMapCaseTileSetRows(
  limit = 20,
): Promise<MapCaseTileSetRow[]> {
  const result = await getPool().query<MapCaseTileSetRow>(
    `
      SELECT
        tile_set.*,
        staff_users.username AS updated_by_username
      FROM map_case_tile_sets AS tile_set
      LEFT JOIN staff_users ON staff_users.id = tile_set.updated_by_user_id
      ORDER BY tile_set.is_active DESC, tile_set.created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function getPublicMapCaseTileManifest(): Promise<PublicMapCaseTileManifest> {
  const hasDatabase = await ensureDatabaseReady();
  const currentStateHashPromise = getCachedPublicStateHash();

  if (!hasDatabase) {
    return createVectorFallbackMapCaseTileManifest(
      await currentStateHashPromise,
    );
  }

  const activeTileSet = await selectActiveReadyMapCaseTileSet();
  const currentStateHash = await currentStateHashPromise;

  return activeTileSet
    ? await toPublicManifest(activeTileSet, currentStateHash)
    : createVectorFallbackMapCaseTileManifest(currentStateHash);
}

export async function getMapCaseTileAdminStatus(): Promise<MapCaseTileAdminStatus> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const [rows, currentStateHash] = await Promise.all([
    listMapCaseTileSetRows(),
    computeCurrentStateHashSafe(),
  ]);
  const records = rows.map(toMapCaseTileSetAdminRecord);
  const active = records.find((record) => record.is_active) ?? null;

  return {
    active,
    latest: records,
    current_state_hash: currentStateHash,
    stale: Boolean(active && currentStateHash && active.state_hash !== currentStateHash),
    fallback: active === null,
    expected_tile_count: getExpectedMapCaseTileCount(),
  };
}

async function markMapCaseTileSetFailed(
  idTileSet: string,
  error: unknown,
): Promise<void> {
  await getPool().query(
    `
      UPDATE map_case_tile_sets
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

export async function regenerateMapCaseTiles(
  userId: number,
): Promise<MapCaseTileAdminStatus> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const state = await computeMapCaseTileState();
  const idTileSet = crypto.randomUUID();
  const tilesPublicPath = getMapCaseTileSetTilesPublicPath(idTileSet);
  const tilesDir = getMapCaseTileSetTilesDir(idTileSet);

  await getPool().query(
    `
      INSERT INTO map_case_tile_sets (
        id_tile_set,
        state_hash,
        tiles_path,
        tile_size,
        min_zoom,
        max_zoom,
        resolutions_json,
        generation_status,
        is_active,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'generating', FALSE, $8)
    `,
    [
      idTileSet,
      state.stateHash,
      tilesPublicPath,
      MAP_TILE_SIZE,
      MAP_TILE_MIN_ZOOM,
      MAP_TILE_MAX_ZOOM,
      JSON.stringify(MAP_TILE_RESOLUTIONS),
      userId,
    ],
  );

  try {
    await generateMapCaseTiles({ state, outputDir: tilesDir });
    await assertCompleteMapCaseTiles(tilesDir);

    const client = await getPool().connect();

    try {
      await client.query("BEGIN");
      await client.query(`
        UPDATE map_case_tile_sets
        SET
          is_active = FALSE,
          updated_at = NOW()
        WHERE is_active = TRUE
      `);
      await client.query(
        `
          UPDATE map_case_tile_sets
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
    await markMapCaseTileSetFailed(idTileSet, error);
    await rm(getMapCaseTileSetDirectory(idTileSet), {
      recursive: true,
      force: true,
    }).catch((rmError: unknown) => {
      console.error("Suppression des tuiles de cases echouees impossible.", rmError);
    });
    throw error;
  }

  return getMapCaseTileAdminStatus();
}
