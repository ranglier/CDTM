import { mkdir, rm, writeFile } from "node:fs/promises";
import crypto from "node:crypto";

import type {
  MapBackgroundAdminRecord,
  PublicMapBackgroundManifest,
} from "@/map/background";
import { createDefaultMapBackgroundManifest } from "@/map/background";
import {
  MAP_BACKGROUND_HEIGHT,
  MAP_BACKGROUND_WIDTH,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
  MAP_TILE_WEBP_QUALITY,
} from "@/map/config";
import { ensureDatabaseReady, getPool } from "@/server/db";
import {
  assertCompleteMapBackgroundTiles,
  generateMapBackgroundTiles,
  getMapBackgroundDirectory,
  getMapBackgroundSourcePath,
  getMapBackgroundSourcePublicPath,
  getMapBackgroundTileUrlTemplate,
  getMapBackgroundTilesDir,
  getMapBackgroundTilesPublicPath,
  validateMapBackgroundUploadFile,
} from "@/server/map-background-tiling";

type MapBackgroundRow = {
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
  generation_status: "generating" | "ready" | "failed";
  generation_error: string | null;
  is_active: boolean;
  created_at: Date | string;
  generated_at: Date | string | null;
  activated_at: Date | string | null;
  updated_by_user_id: number | null;
  updated_by_username?: string | null;
};

function toIsoStringOrNull(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function toMapBackgroundAdminRecord(
  row: MapBackgroundRow,
): MapBackgroundAdminRecord {
  return {
    id_background: row.id_background,
    label: row.label,
    source_path: row.source_path,
    tiles_path: row.tiles_path,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    width: row.width,
    height: row.height,
    tile_size: row.tile_size,
    min_zoom: row.min_zoom,
    max_zoom: row.max_zoom,
    webp_quality: row.webp_quality,
    generation_status: row.generation_status,
    generation_error: row.generation_error,
    is_active: row.is_active,
    created_at: new Date(row.created_at).toISOString(),
    generated_at: toIsoStringOrNull(row.generated_at),
    activated_at: toIsoStringOrNull(row.activated_at),
    updated_by_user_id: row.updated_by_user_id,
    updated_by_username: row.updated_by_username ?? null,
  };
}

function toPublicManifest(row: MapBackgroundRow): PublicMapBackgroundManifest {
  return {
    mode: "tiles",
    source: "uploaded",
    id: row.id_background,
    label: row.label,
    width: row.width,
    height: row.height,
    extent: [0, -MAP_BACKGROUND_HEIGHT, MAP_BACKGROUND_WIDTH, 0],
    tileSize: row.tile_size,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    resolutions: [...MAP_TILE_RESOLUTIONS],
    webpQuality: row.webp_quality,
    imageUrl: null,
    tileUrlTemplate: getMapBackgroundTileUrlTemplate(row.tiles_path),
    activatedAt: toIsoStringOrNull(row.activated_at),
  };
}

function normalizeUploadLabel(label: unknown, fallback: string): string {
  const normalized = typeof label === "string" ? label.trim() : "";

  return normalized.length > 0 ? normalized.slice(0, 120) : fallback;
}

function normalizeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Generation du fond impossible.";

  return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
}

function assertMapBackgroundId(idBackground: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(idBackground)) {
    throw new Error("Fond de carte introuvable.");
  }

  return idBackground;
}

async function selectMapBackgroundById(
  idBackground: string,
): Promise<MapBackgroundAdminRecord | null> {
  const result = await getPool().query<MapBackgroundRow>(
    `
      SELECT
        background.*,
        staff_users.username AS updated_by_username
      FROM map_backgrounds AS background
      LEFT JOIN staff_users ON staff_users.id = background.updated_by_user_id
      WHERE background.id_background = $1
      LIMIT 1
    `,
    [idBackground],
  );

  return result.rows[0]
    ? toMapBackgroundAdminRecord(result.rows[0])
    : null;
}

export async function getPublicMapBackgroundManifest(): Promise<PublicMapBackgroundManifest> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return createDefaultMapBackgroundManifest("tiles");
  }

  const result = await getPool().query<MapBackgroundRow>(
    `
      SELECT *
      FROM map_backgrounds
      WHERE is_active = TRUE
        AND generation_status = 'ready'
      ORDER BY activated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
  );

  const activeBackground = result.rows[0];

  return activeBackground
    ? toPublicManifest(activeBackground)
    : createDefaultMapBackgroundManifest("tiles");
}

export async function listMapBackgrounds(): Promise<
  MapBackgroundAdminRecord[]
> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const result = await getPool().query<MapBackgroundRow>(
    `
      SELECT
        background.*,
        staff_users.username AS updated_by_username
      FROM map_backgrounds AS background
      LEFT JOIN staff_users ON staff_users.id = background.updated_by_user_id
      ORDER BY background.is_active DESC, background.created_at DESC
    `,
  );

  return result.rows.map(toMapBackgroundAdminRecord);
}

async function markMapBackgroundFailed(
  idBackground: string,
  error: unknown,
): Promise<void> {
  await getPool().query(
    `
      UPDATE map_backgrounds
      SET
        generation_status = 'failed',
        generation_error = $2,
        is_active = FALSE,
        updated_at = NOW()
      WHERE id_background = $1
    `,
    [idBackground, normalizeErrorMessage(error)],
  );
}

export async function activateMapBackground(
  idBackground: string,
  userId: number,
): Promise<MapBackgroundAdminRecord> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const safeIdBackground = assertMapBackgroundId(idBackground);

  await assertCompleteMapBackgroundTiles(
    getMapBackgroundTilesDir(safeIdBackground),
  );

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<MapBackgroundRow>(
      `
        SELECT *
        FROM map_backgrounds
        WHERE id_background = $1
        FOR UPDATE
      `,
      [safeIdBackground],
    );
    const current = currentResult.rows[0];

    if (!current) {
      throw new Error("Fond de carte introuvable.");
    }

    if (current.generation_status !== "ready") {
      throw new Error("Ce fond n'est pas pret a etre active.");
    }

    await client.query(`
      UPDATE map_backgrounds
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE is_active = TRUE
    `);

    await client.query(
      `
        UPDATE map_backgrounds
        SET
          is_active = TRUE,
          activated_at = NOW(),
          updated_at = NOW(),
          updated_by_user_id = $2
        WHERE id_background = $1
      `,
      [safeIdBackground, userId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const activated = await selectMapBackgroundById(safeIdBackground);

  if (!activated) {
    throw new Error("Fond de carte introuvable.");
  }

  return activated;
}

export async function deleteMapBackground(
  idBackground: string,
): Promise<MapBackgroundAdminRecord> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const safeIdBackground = assertMapBackgroundId(idBackground);
  const client = await getPool().connect();
  let deletedRow: MapBackgroundRow | null = null;

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<MapBackgroundRow>(
      `
        SELECT *
        FROM map_backgrounds
        WHERE id_background = $1
        FOR UPDATE
      `,
      [safeIdBackground],
    );
    const current = currentResult.rows[0];

    if (!current) {
      throw new Error("Fond de carte introuvable.");
    }

    if (current.is_active) {
      throw new Error("Impossible de supprimer le fond actif.");
    }

    const deleteResult = await client.query<MapBackgroundRow>(
      `
        DELETE FROM map_backgrounds
        WHERE id_background = $1
        RETURNING *
      `,
      [safeIdBackground],
    );
    deletedRow = deleteResult.rows[0] ?? current;

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await rm(getMapBackgroundDirectory(safeIdBackground), {
    recursive: true,
    force: true,
  }).catch((error: unknown) => {
    console.error("Suppression du dossier de fond de carte impossible.", error);
  });

  return toMapBackgroundAdminRecord(deletedRow);
}

export async function createMapBackgroundFromUpload({
  file,
  label,
  userId,
}: {
  file: File;
  label?: string | null;
  userId: number;
}): Promise<MapBackgroundAdminRecord> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const upload = await validateMapBackgroundUploadFile(file);
  const idBackground = crypto.randomUUID();
  const normalizedLabel = normalizeUploadLabel(label, upload.originalName);
  const backgroundDir = getMapBackgroundDirectory(idBackground);
  const sourcePath = getMapBackgroundSourcePath(
    idBackground,
    upload.extension,
  );
  const tilesDir = getMapBackgroundTilesDir(idBackground);
  const sourcePublicPath = getMapBackgroundSourcePublicPath(
    idBackground,
    upload.extension,
  );
  const tilesPublicPath = getMapBackgroundTilesPublicPath(idBackground);

  await mkdir(backgroundDir, { recursive: true });
  await writeFile(sourcePath, upload.buffer);

  await getPool().query(
    `
      INSERT INTO map_backgrounds (
        id_background,
        label,
        source_path,
        tiles_path,
        mime_type,
        size_bytes,
        width,
        height,
        tile_size,
        min_zoom,
        max_zoom,
        webp_quality,
        generation_status,
        is_active,
        updated_by_user_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, 'generating', FALSE, $13
      )
    `,
    [
      idBackground,
      normalizedLabel,
      sourcePublicPath,
      tilesPublicPath,
      upload.mimeType,
      upload.sizeBytes,
      upload.width,
      upload.height,
      MAP_TILE_SIZE,
      MAP_TILE_MIN_ZOOM,
      MAP_TILE_MAX_ZOOM,
      MAP_TILE_WEBP_QUALITY,
      userId,
    ],
  );

  try {
    await generateMapBackgroundTiles({
      sourcePath,
      outputDir: tilesDir,
      tileSize: MAP_TILE_SIZE,
      minZoom: MAP_TILE_MIN_ZOOM,
      maxZoom: MAP_TILE_MAX_ZOOM,
      webpQuality: MAP_TILE_WEBP_QUALITY,
    });
    await assertCompleteMapBackgroundTiles(tilesDir);
    await getPool().query(
      `
        UPDATE map_backgrounds
        SET
          generation_status = 'ready',
          generation_error = NULL,
          generated_at = NOW(),
          updated_at = NOW()
        WHERE id_background = $1
      `,
      [idBackground],
    );

    return activateMapBackground(idBackground, userId);
  } catch (error) {
    await markMapBackgroundFailed(idBackground, error);
    throw error;
  }
}
