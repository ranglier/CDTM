import {
  MAP_CASE_TILE_PREFETCH_MARGIN,
  MAP_CASE_TILE_PRELOAD_LEVELS,
} from "./config.ts";
import type { PublicMapCaseTileManifest } from "./case-tiles.ts";
import { normalizeMapDisplayMode, type MapDisplayMode } from "./types.ts";

export type CaseTilePrefetchRequest = {
  z: number;
  x: number;
  y: number;
  url: string;
};

type CaseTilePrefetchOptions = {
  manifest: PublicMapCaseTileManifest | null;
  displayMode: MapDisplayMode;
  extent: [number, number, number, number];
  resolution: number;
  margin?: number;
  preloadLevels?: number;
};

const prefetchedCaseTileUrls = new Set<string>();

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getNearestZoomForResolution(
  resolutions: number[],
  minZoom: number,
  maxZoom: number,
  resolution: number,
): number {
  let nearestZoom = minZoom;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const candidateResolution = resolutions[z - minZoom];

    if (!Number.isFinite(candidateResolution) || candidateResolution <= 0) {
      continue;
    }

    const distance = Math.abs(
      Math.log2(resolution / candidateResolution),
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestZoom = z;
    }
  }

  return nearestZoom;
}

function getTileRangeForExtent({
  extent,
  mapExtent,
  tileSize,
  resolution,
  margin,
}: {
  extent: [number, number, number, number];
  mapExtent: [number, number, number, number];
  tileSize: number;
  resolution: number;
  margin: number;
}): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const worldTileSize = tileSize * resolution;
  const mapWidth = mapExtent[2] - mapExtent[0];
  const mapHeight = mapExtent[3] - mapExtent[1];
  const columns = Math.ceil(mapWidth / worldTileSize);
  const rows = Math.ceil(mapHeight / worldTileSize);

  if (
    !Number.isFinite(worldTileSize) ||
    worldTileSize <= 0 ||
    columns <= 0 ||
    rows <= 0
  ) {
    return null;
  }

  const clampedMinX = clamp(extent[0], mapExtent[0], mapExtent[2]);
  const clampedMinY = clamp(extent[1], mapExtent[1], mapExtent[3]);
  const clampedMaxX = clamp(extent[2], mapExtent[0], mapExtent[2]);
  const clampedMaxY = clamp(extent[3], mapExtent[1], mapExtent[3]);

  if (clampedMinX > clampedMaxX || clampedMinY > clampedMaxY) {
    return null;
  }

  const epsilon = 1e-9;
  const minX = clamp(
    Math.floor((clampedMinX - mapExtent[0]) / worldTileSize) - margin,
    0,
    columns - 1,
  );
  const maxX = clamp(
    Math.floor((clampedMaxX - mapExtent[0] - epsilon) / worldTileSize) +
      margin,
    0,
    columns - 1,
  );
  const minY = clamp(
    Math.floor((mapExtent[3] - clampedMaxY) / worldTileSize) - margin,
    0,
    rows - 1,
  );
  const maxY = clamp(
    Math.floor((mapExtent[3] - clampedMinY - epsilon) / worldTileSize) +
      margin,
    0,
    rows - 1,
  );

  return { minX, maxX, minY, maxY };
}

export function getCaseTilePrefetchRequests({
  manifest,
  displayMode,
  extent,
  resolution,
  margin = MAP_CASE_TILE_PREFETCH_MARGIN,
  preloadLevels = MAP_CASE_TILE_PRELOAD_LEVELS,
}: CaseTilePrefetchOptions): CaseTilePrefetchRequest[] {
  if (
    !manifest ||
    manifest.mode !== "raster" ||
    !Number.isFinite(resolution) ||
    resolution <= 0
  ) {
    return [];
  }

  const mode = normalizeMapDisplayMode(displayMode);
  const template = manifest.tileUrlTemplates[mode];
  const currentZoom = getNearestZoomForResolution(
    manifest.resolutions,
    manifest.minZoom,
    manifest.maxZoom,
    resolution,
  );
  const minPrefetchZoom = Math.max(
    manifest.minZoom,
    currentZoom - Math.max(0, preloadLevels),
  );
  const requests: CaseTilePrefetchRequest[] = [];

  for (let z = currentZoom; z >= minPrefetchZoom; z -= 1) {
    const tileResolution = manifest.resolutions[z - manifest.minZoom];
    const tileRange = getTileRangeForExtent({
      extent,
      mapExtent: manifest.extent,
      tileSize: manifest.tileSize,
      resolution: tileResolution,
      margin,
    });

    if (!tileRange) {
      continue;
    }

    for (let y = tileRange.minY; y <= tileRange.maxY; y += 1) {
      for (let x = tileRange.minX; x <= tileRange.maxX; x += 1) {
        requests.push({
          z,
          x,
          y,
          url: formatTileUrl(template, z, x, y),
        });
      }
    }
  }

  return requests;
}

export function prefetchCaseRasterTiles(
  options: CaseTilePrefetchOptions,
): void {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return;
  }

  for (const request of getCaseTilePrefetchRequests(options)) {
    if (prefetchedCaseTileUrls.has(request.url)) {
      continue;
    }

    prefetchedCaseTileUrls.add(request.url);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (typeof image.decode === "function") {
        void image.decode().catch(() => {});
      }
    };
    image.onerror = () => {
      prefetchedCaseTileUrls.delete(request.url);
    };
    image.src = request.url;
  }
}

export function clearCaseTilePrefetchCacheForTests(): void {
  prefetchedCaseTileUrls.clear();
}
