import crypto from "node:crypto";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { PublicMapBackgroundManifest } from "@/map/background";
import {
  CASE_TILE_DISPLAY_MODES,
  getMapCaseTilePlan,
  type CaseTileDisplayMode,
  type PublicMapCaseTileManifest,
} from "@/map/case-tiles";
import {
  getExpectedMapCompositeTileCount,
  isMapCompositeTileProfile,
  type MapCompositeTileProfile,
} from "@/map/composite-tiles";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "@/map/config";
import { getServerEnv } from "@/server/env";
import { getPublicMapBackgroundManifest } from "@/server/map-background-repository";
import { getPublicMapCaseTileManifest } from "@/server/map-case-tile-repository";

export const MAP_COMPOSITE_TILE_GENERATOR_VERSION = "composite-tiles-v1";

const MAP_COMPOSITE_TILES_UPLOAD_SUBDIR = "map-composite-tiles";
const MAP_COMPOSITE_TILE_WEBP_QUALITY_BY_PROFILE: Record<
  MapCompositeTileProfile,
  number
> = {
  mobile: 82,
  desktop: 88,
};

type StableJson =
  | null
  | string
  | number
  | boolean
  | StableJson[]
  | { [key: string]: StableJson };

export type MapCompositeTileState = {
  profile: MapCompositeTileProfile;
  stateHash: string;
  backgroundHash: string;
  caseTileHash: string;
  backgroundManifest: PublicMapBackgroundManifest;
  caseTileManifest: Extract<PublicMapCaseTileManifest, { mode: "raster" }>;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(",")}}`;
}

function toStableJson(value: unknown): StableJson {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toStableJson);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toStableJson(item)]),
    );
  }

  return null;
}

function hashStablePayload(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(stableStringify(toStableJson(value)))
    .digest("hex");
}

function formatTileUrl(
  tileUrlTemplate: string,
  z: number,
  x: number,
  y: number,
): string {
  return tileUrlTemplate
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

function normalizePublicPath(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function publicTilePathToAbsolutePath(publicPath: string): string {
  const normalized = normalizePublicPath(publicPath);

  if (normalized.startsWith("/uploads/")) {
    const relativePath = normalized.slice("/uploads/".length);
    return path.join(getServerEnv().uploadsDir, relativePath);
  }

  if (normalized.startsWith("/maps/")) {
    return path.join(process.cwd(), "public", normalized.slice(1));
  }

  throw new Error("Chemin de tuile non autorise.");
}

function resolveTileTemplatePath({
  template,
  z,
  x,
  y,
}: {
  template: string;
  z: number;
  x: number;
  y: number;
}): string {
  return publicTilePathToAbsolutePath(formatTileUrl(template, z, x, y));
}

function buildBackgroundHash(
  manifest: PublicMapBackgroundManifest,
): string {
  return hashStablePayload({
    source: manifest.source,
    id: manifest.id,
    label: manifest.label,
    tileUrlTemplate: manifest.tileUrlTemplate,
    activatedAt: manifest.activatedAt,
    tileSize: manifest.tileSize,
    minZoom: manifest.minZoom,
    maxZoom: manifest.maxZoom,
    resolutions: manifest.resolutions,
    webpQuality: manifest.webpQuality,
  });
}

function buildCaseTileHash(
  manifest: Extract<PublicMapCaseTileManifest, { mode: "raster" }>,
): string {
  return hashStablePayload({
    id: manifest.id,
    stateHash: manifest.stateHash,
    generatedAt: manifest.generatedAt,
    tileUrlTemplates: manifest.tileUrlTemplates,
    pickingTemplate: manifest.picking?.tileUrlTemplate ?? null,
    tileSize: manifest.tileSize,
    minZoom: manifest.minZoom,
    maxZoom: manifest.maxZoom,
    resolutions: manifest.resolutions,
  });
}

function buildCompositeStateHash({
  profile,
  backgroundHash,
  caseTileHash,
}: {
  profile: MapCompositeTileProfile;
  backgroundHash: string;
  caseTileHash: string;
}): string {
  return hashStablePayload({
    generator: MAP_COMPOSITE_TILE_GENERATOR_VERSION,
    profile,
    backgroundHash,
    caseTileHash,
    constants: {
      extent: MAP_EXTENT,
      tileSize: MAP_TILE_SIZE,
      minZoom: MAP_TILE_MIN_ZOOM,
      maxZoom: MAP_TILE_MAX_ZOOM,
      resolutions: MAP_TILE_RESOLUTIONS,
      displayModes: CASE_TILE_DISPLAY_MODES,
      webpQuality: MAP_COMPOSITE_TILE_WEBP_QUALITY_BY_PROFILE[profile],
    },
  });
}

export async function computeMapCompositeTileState(
  profile: MapCompositeTileProfile,
): Promise<MapCompositeTileState> {
  if (!isMapCompositeTileProfile(profile)) {
    throw new Error("Profil de tuiles composees invalide.");
  }

  const [backgroundManifest, caseTileManifest] = await Promise.all([
    getPublicMapBackgroundManifest(),
    getPublicMapCaseTileManifest(),
  ]);

  if (
    backgroundManifest.mode !== "tiles" ||
    !backgroundManifest.tileUrlTemplate
  ) {
    throw new Error("Un fond de carte tuile est requis.");
  }

  if (caseTileManifest.mode !== "raster") {
    throw new Error("Un jeu de tuiles de cases raster pret est requis.");
  }

  const backgroundHash = buildBackgroundHash(backgroundManifest);
  const caseTileHash = buildCaseTileHash(caseTileManifest);

  return {
    profile,
    stateHash: buildCompositeStateHash({
      profile,
      backgroundHash,
      caseTileHash,
    }),
    backgroundHash,
    caseTileHash,
    backgroundManifest,
    caseTileManifest,
  };
}

export function getMapCompositeTilesUploadsDir(): string {
  return path.join(getServerEnv().uploadsDir, MAP_COMPOSITE_TILES_UPLOAD_SUBDIR);
}

export function getMapCompositeTileSetDirectory(idTileSet: string): string {
  return path.join(getMapCompositeTilesUploadsDir(), idTileSet);
}

export function getMapCompositeTileSetTilesDir(idTileSet: string): string {
  return path.join(getMapCompositeTileSetDirectory(idTileSet), "tiles");
}

export function getMapCompositeTileSetTilesPublicPath(
  idTileSet: string,
): string {
  return `/uploads/map-composite-tiles/${idTileSet}/tiles`;
}

export function getMapCompositeTileUrlTemplate({
  tilesPath,
  profile,
  mode,
}: {
  tilesPath: string;
  profile: MapCompositeTileProfile;
  mode: CaseTileDisplayMode;
}): string {
  return `${tilesPath}/${profile}/${mode}/{z}/{x}/{y}.webp`;
}

async function renderCompositeTile({
  backgroundPath,
  caseTilePath,
  targetPath,
  profile,
}: {
  backgroundPath: string;
  caseTilePath: string;
  targetPath: string;
  profile: MapCompositeTileProfile;
}): Promise<void> {
  const caseTileBuffer = await readFile(caseTilePath);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await sharp(backgroundPath)
    .ensureAlpha()
    .composite([{ input: caseTileBuffer }])
    .flatten({ background: "#000000" })
    .webp({
      quality: MAP_COMPOSITE_TILE_WEBP_QUALITY_BY_PROFILE[profile],
      effort: 4,
    })
    .toFile(targetPath);
}

export async function generateMapCompositeTiles({
  state,
  outputDir,
}: {
  state: MapCompositeTileState;
  outputDir: string;
}): Promise<{ tileCount: number }> {
  const tmpDir = `${outputDir}.tmp`;
  let tileCount = 0;

  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  for (const mode of CASE_TILE_DISPLAY_MODES) {
    for (const level of getMapCaseTilePlan()) {
      for (let row = 0; row < level.rows; row += 1) {
        for (let column = 0; column < level.columns; column += 1) {
          const backgroundPath = resolveTileTemplatePath({
            template: state.backgroundManifest.tileUrlTemplate!,
            z: level.z,
            x: column,
            y: row,
          });
          const caseTilePath = resolveTileTemplatePath({
            template: state.caseTileManifest.tileUrlTemplates[mode],
            z: level.z,
            x: column,
            y: row,
          });

          await renderCompositeTile({
            backgroundPath,
            caseTilePath,
            profile: state.profile,
            targetPath: path.join(
              tmpDir,
              state.profile,
              mode,
              String(level.z),
              String(column),
              `${row}.webp`,
            ),
          });
          tileCount += 1;
        }
      }
    }
  }

  await rename(tmpDir, outputDir);
  return { tileCount };
}

export async function assertCompleteMapCompositeTiles({
  tilesDir,
  profile,
}: {
  tilesDir: string;
  profile: MapCompositeTileProfile;
}): Promise<void> {
  let tileCount = 0;

  for (const mode of CASE_TILE_DISPLAY_MODES) {
    for (const level of getMapCaseTilePlan()) {
      for (let row = 0; row < level.rows; row += 1) {
        for (let column = 0; column < level.columns; column += 1) {
          const tilePath = path.join(
            tilesDir,
            profile,
            mode,
            String(level.z),
            String(column),
            `${row}.webp`,
          );
          const tileStat = await stat(tilePath);

          if (!tileStat.isFile()) {
            throw new Error("Tuiles composees incompletes.");
          }

          const metadata = await sharp(tilePath).metadata();

          if (
            metadata.width !== MAP_TILE_SIZE ||
            metadata.height !== MAP_TILE_SIZE
          ) {
            throw new Error("Dimensions de tuile composee inattendues.");
          }

          if (metadata.hasAlpha) {
            throw new Error("Tuile composee non opaque.");
          }

          tileCount += 1;
        }
      }
    }
  }

  if (tileCount !== getExpectedMapCompositeTileCount()) {
    throw new Error("Nombre de tuiles composees inattendu.");
  }
}

function assertTileSetId(value: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
    throw new Error("Jeu de tuiles introuvable.");
  }

  return value;
}

function assertTileSegment(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("Tuile introuvable.");
  }

  return value;
}

function assertTileMode(value: string): CaseTileDisplayMode {
  if ((CASE_TILE_DISPLAY_MODES as readonly string[]).includes(value)) {
    return value as CaseTileDisplayMode;
  }

  throw new Error("Mode de tuiles introuvable.");
}

export async function readMapCompositeTileUpload({
  idTileSet,
  profile,
  mode,
  z,
  x,
  filename,
}: {
  idTileSet: string;
  profile: string;
  mode: string;
  z: string;
  x: string;
  filename: string;
}): Promise<Buffer> {
  const safeId = assertTileSetId(idTileSet);

  if (!isMapCompositeTileProfile(profile)) {
    throw new Error("Profil de tuiles introuvable.");
  }

  const safeMode = assertTileMode(mode);
  const safeZ = assertTileSegment(z);
  const safeX = assertTileSegment(x);
  const match = /^(\d+)\.webp$/.exec(filename);

  if (!match) {
    throw new Error("Tuile introuvable.");
  }

  const safeY = assertTileSegment(match[1]);
  const absolutePath = path.join(
    getMapCompositeTileSetTilesDir(safeId),
    profile,
    safeMode,
    safeZ,
    safeX,
    `${safeY}.webp`,
  );
  const tileStat = await stat(absolutePath);

  if (!tileStat.isFile()) {
    throw new Error("Tuile introuvable.");
  }

  return readFile(absolutePath);
}

export const testableMapCompositeTilingInternals = {
  buildCompositeStateHash,
  publicTilePathToAbsolutePath,
  stableStringify,
};
