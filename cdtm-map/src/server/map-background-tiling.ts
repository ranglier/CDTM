import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  MAP_BACKGROUND_HEIGHT,
  MAP_BACKGROUND_WIDTH,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
  MAP_TILE_WEBP_QUALITY,
} from "@/map/config";
import { getServerEnv } from "@/server/env";

const MAP_BACKGROUND_UPLOAD_SUBDIR = "map-backgrounds";
const MAX_MAP_BACKGROUND_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MAP_BACKGROUND_MIME_TYPES = new Map([
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export type ValidatedMapBackgroundUpload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  extension: ".png" | ".webp";
  sizeBytes: number;
  width: number;
  height: number;
};

export type MapTilePlanLevel = {
  z: number;
  resolution: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  tileCount: number;
};

export type GenerateMapBackgroundTilesOptions = {
  sourcePath: string;
  outputDir: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  webpQuality?: number;
};

type PreparedMapTileLevelImage = {
  data: Buffer;
  width: number;
  height: number;
  channels: sharp.Channels;
};

function sanitizeOriginalName(value: string): string {
  const trimmed = value.trim();
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return sanitized.length > 0 ? sanitized : "map-background";
}

function assertAllowedMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();

  if (!ALLOWED_MAP_BACKGROUND_MIME_TYPES.has(normalized)) {
    throw new Error("Type d'image non autorise.");
  }

  return normalized;
}

function assertExpectedExtension(filename: string, mimeType: string): void {
  const expectedExtension = ALLOWED_MAP_BACKGROUND_MIME_TYPES.get(mimeType);
  const extension = path.extname(filename).toLowerCase();

  if (!expectedExtension || extension !== expectedExtension) {
    throw new Error("Extension de fichier invalide.");
  }
}

function assertPngSignature(buffer: Buffer): void {
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (
    buffer.byteLength < pngSignature.byteLength ||
    !buffer.subarray(0, pngSignature.byteLength).equals(pngSignature)
  ) {
    throw new Error("Signature PNG invalide.");
  }
}

function assertWebpSignature(buffer: Buffer): void {
  if (
    buffer.byteLength < 12 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error("Signature WebP invalide.");
  }
}

function assertMapBackgroundDimensions(width: unknown, height: unknown): void {
  if (width !== MAP_BACKGROUND_WIDTH || height !== MAP_BACKGROUND_HEIGHT) {
    throw new Error(
      `Dimensions incompatibles: le fond doit mesurer ${MAP_BACKGROUND_WIDTH} x ${MAP_BACKGROUND_HEIGHT} px.`,
    );
  }
}

function assertMapBackgroundIsNotAnimated(pages: unknown): void {
  if (typeof pages === "number" && pages > 1) {
    throw new Error("Les images animees ne sont pas autorisees.");
  }
}

export function getMapBackgroundUploadsDir(): string {
  return path.join(getServerEnv().uploadsDir, MAP_BACKGROUND_UPLOAD_SUBDIR);
}

export function getMapBackgroundDirectory(idBackground: string): string {
  return path.join(getMapBackgroundUploadsDir(), idBackground);
}

export function getMapBackgroundSourcePath(
  idBackground: string,
  extension: string,
): string {
  return path.join(getMapBackgroundDirectory(idBackground), `source${extension}`);
}

export function getMapBackgroundTilesDir(idBackground: string): string {
  return path.join(getMapBackgroundDirectory(idBackground), "tiles");
}

export function getMapBackgroundSourcePublicPath(
  idBackground: string,
  extension: string,
): string {
  return `/uploads/map-backgrounds/${idBackground}/source${extension}`;
}

export function getMapBackgroundTilesPublicPath(idBackground: string): string {
  return `/uploads/map-backgrounds/${idBackground}/tiles`;
}

export function getMapBackgroundTileUrlTemplate(
  tilesPath: string,
): string {
  return `${tilesPath}/{z}/{x}/{y}.webp`;
}

export function getMapTilePlan(
  minZoom = MAP_TILE_MIN_ZOOM,
  maxZoom = MAP_TILE_MAX_ZOOM,
  tileSize = MAP_TILE_SIZE,
): MapTilePlanLevel[] {
  const plan: MapTilePlanLevel[] = [];

  for (const [index, resolution] of MAP_TILE_RESOLUTIONS.entries()) {
    const z = index + MAP_TILE_MIN_ZOOM;

    if (z < minZoom || z > maxZoom) {
      continue;
    }

    const width = Math.ceil(MAP_BACKGROUND_WIDTH / resolution);
    const height = Math.ceil(MAP_BACKGROUND_HEIGHT / resolution);
    const columns = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);

    plan.push({
      z,
      resolution,
      width,
      height,
      columns,
      rows,
      tileCount: columns * rows,
    });
  }

  return plan;
}

export function getExpectedMapTileCount(): number {
  return getMapTilePlan().reduce((sum, level) => sum + level.tileCount, 0);
}

export async function validateMapBackgroundUploadFile(
  file: File,
): Promise<ValidatedMapBackgroundUpload> {
  const mimeType = assertAllowedMimeType(file.type);
  assertExpectedExtension(file.name, mimeType);

  if (file.size <= 0 || file.size > MAX_MAP_BACKGROUND_SIZE_BYTES) {
    throw new Error("Taille d'image invalide.");
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  if (mimeType === "image/png") {
    assertPngSignature(sourceBuffer);
  } else if (mimeType === "image/webp") {
    assertWebpSignature(sourceBuffer);
  }

  const metadata = await sharp(sourceBuffer, { animated: true }).metadata();
  assertMapBackgroundDimensions(metadata.width, metadata.height);
  assertMapBackgroundIsNotAnimated(metadata.pages);

  return {
    buffer: sourceBuffer,
    originalName: sanitizeOriginalName(file.name),
    mimeType,
    extension:
      (ALLOWED_MAP_BACKGROUND_MIME_TYPES.get(mimeType) as ".png" | ".webp") ??
      ".png",
    sizeBytes: sourceBuffer.byteLength,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

async function writeTile({
  levelImage,
  targetPath,
  level,
  column,
  row,
  tileSize,
  webpQuality,
}: {
  levelImage: PreparedMapTileLevelImage;
  targetPath: string;
  level: MapTilePlanLevel;
  column: number;
  row: number;
  tileSize: number;
  webpQuality: number;
}): Promise<void> {
  const left = column * tileSize;
  const top = row * tileSize;
  const width = Math.min(tileSize, level.width - left);
  const height = Math.min(tileSize, level.height - top);

  if (width <= 0 || height <= 0) {
    return;
  }

  let pipeline = sharp(levelImage.data, {
    raw: {
      width: levelImage.width,
      height: levelImage.height,
      channels: levelImage.channels,
    },
  }).extract({ left, top, width, height });

  if (width < tileSize || height < tileSize) {
    pipeline = pipeline.extend({
      right: tileSize - width,
      bottom: tileSize - height,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await pipeline.webp({ quality: webpQuality }).toFile(targetPath);
}

async function prepareMapTileLevelImage(
  sourcePath: string,
  level: MapTilePlanLevel,
): Promise<PreparedMapTileLevelImage> {
  const { data, info } = await sharp(sourcePath, { animated: false })
    .ensureAlpha()
    .resize({
      width: level.width,
      height: level.height,
      fit: "fill",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels as sharp.Channels,
  };
}

export async function generateMapBackgroundTiles({
  sourcePath,
  outputDir,
  tileSize = MAP_TILE_SIZE,
  minZoom = MAP_TILE_MIN_ZOOM,
  maxZoom = MAP_TILE_MAX_ZOOM,
  webpQuality = MAP_TILE_WEBP_QUALITY,
}: GenerateMapBackgroundTilesOptions): Promise<{ tileCount: number }> {
  const metadata = await sharp(sourcePath, { animated: true }).metadata();
  assertMapBackgroundDimensions(metadata.width, metadata.height);
  assertMapBackgroundIsNotAnimated(metadata.pages);

  const plan = getMapTilePlan(minZoom, maxZoom, tileSize);
  const tmpDir = `${outputDir}.tmp`;
  let tileCount = 0;

  await rm(tmpDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  for (const level of plan) {
    const levelImage = await prepareMapTileLevelImage(sourcePath, level);

    for (let row = 0; row < level.rows; row += 1) {
      for (let column = 0; column < level.columns; column += 1) {
        await writeTile({
          levelImage,
          targetPath: path.join(
            tmpDir,
            String(level.z),
            String(column),
            `${row}.webp`,
          ),
          level,
          column,
          row,
          tileSize,
          webpQuality,
        });
        tileCount += 1;
      }
    }
  }

  await rename(tmpDir, outputDir);
  return { tileCount };
}

export async function assertCompleteMapBackgroundTiles(
  tilesDir: string,
): Promise<void> {
  for (const level of getMapTilePlan()) {
    for (let row = 0; row < level.rows; row += 1) {
      for (let column = 0; column < level.columns; column += 1) {
        const tilePath = path.join(
          tilesDir,
          String(level.z),
          String(column),
          `${row}.webp`,
        );
        const tileStat = await stat(tilePath);

        if (!tileStat.isFile()) {
          throw new Error("Tuiles de fond incompletes.");
        }
      }
    }
  }
}

function assertBackgroundId(value: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
    throw new Error("Fond de carte introuvable.");
  }

  return value;
}

function assertTileSegment(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("Tuile introuvable.");
  }

  return value;
}

export async function readMapBackgroundTileUpload({
  idBackground,
  z,
  x,
  filename,
}: {
  idBackground: string;
  z: string;
  x: string;
  filename: string;
}): Promise<Buffer> {
  const safeId = assertBackgroundId(idBackground);
  const safeZ = assertTileSegment(z);
  const safeX = assertTileSegment(x);
  const match = /^(\d+)\.webp$/.exec(filename);

  if (!match) {
    throw new Error("Tuile introuvable.");
  }

  const safeY = assertTileSegment(match[1]);
  const absolutePath = path.join(
    getMapBackgroundTilesDir(safeId),
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
