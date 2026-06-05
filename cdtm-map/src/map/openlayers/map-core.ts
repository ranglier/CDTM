"use client";

import { defaults as defaultControls } from "ol/control/defaults";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import type BaseLayer from "ol/layer/Base";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import Map from "ol/Map";
import { addProjection } from "ol/proj";
import Projection from "ol/proj/Projection";
import ImageTileSource from "ol/source/ImageTile";
import ImageStatic from "ol/source/ImageStatic";
import TileGrid from "ol/tilegrid/TileGrid";
import View from "ol/View";

import {
  createDefaultMapBackgroundManifest,
  normalizePublicMapBackgroundManifest,
  type PublicMapBackgroundManifest,
} from "@/map/background";
import {
  createVectorFallbackMapCaseTileManifest,
  normalizePublicMapCaseTileManifest,
  type PublicMapCaseTileManifest,
} from "@/map/case-tiles";
import {
  CASES_EXTENT,
  MAP_BACKGROUND_PATH,
  MAP_CASE_TILE_BACKUP_IDLE_OPACITY,
  MAP_CASE_TILE_BACKUP_MAX_ZOOM,
  MAP_CASE_TILE_CACHE_SIZE,
  MAP_CASE_TILE_PRELOAD_LEVELS,
  MAP_CASE_TILE_TRANSITION_MS,
  MAP_EXTENT,
  MAP_FIT_PADDING,
  MAP_MAX_ZOOM,
  MAP_PROJECTION_CODE,
} from "@/map/config";
import { measureMapPerformanceAsync } from "@/map/map-performance";
import { normalizeMapDisplayMode, type MapDisplayMode } from "@/map/types";

let backgroundImagePreloadPromise: Promise<void> | null = null;

export function shouldUseStaticMapBackground(): boolean {
  return process.env.NEXT_PUBLIC_CDTM_MAP_BACKGROUND === "static";
}

export function shouldUseVectorCaseTiles(): boolean {
  return process.env.NEXT_PUBLIC_CDTM_CASE_TILES === "vector";
}

function formatMapTileUrl(
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

export const cdtmProjection = new Projection({
  code: MAP_PROJECTION_CODE,
  extent: MAP_EXTENT,
  units: "pixels",
});

addProjection(cdtmProjection);

export function createCdtmView() {
  return new View({
    projection: cdtmProjection,
    center: [1600, -2000],
    extent: MAP_EXTENT,
    maxZoom: MAP_MAX_ZOOM,
    showFullExtent: true,
  });
}

export async function loadCdtmMapBackgroundManifest(): Promise<PublicMapBackgroundManifest> {
  if (shouldUseStaticMapBackground() || typeof window === "undefined") {
    return createDefaultMapBackgroundManifest(
      shouldUseStaticMapBackground() ? "static" : "tiles",
    );
  }

  try {
    const response = await measureMapPerformanceAsync(
      "api.map.background.manifest",
      () => fetch("/api/map/background"),
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = normalizePublicMapBackgroundManifest(
      await response.json(),
    );

    return manifest ?? createDefaultMapBackgroundManifest("tiles");
  } catch (error) {
    console.error("Impossible de charger le manifeste du fond de carte.", error);
    return createDefaultMapBackgroundManifest("tiles");
  }
}

export async function loadCdtmMapCaseTileManifest(): Promise<PublicMapCaseTileManifest> {
  if (shouldUseVectorCaseTiles() || typeof window === "undefined") {
    return createVectorFallbackMapCaseTileManifest();
  }

  try {
    const response = await measureMapPerformanceAsync(
      "api.map.case-tiles.manifest",
      () => fetch("/api/map/case-tiles/manifest"),
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = normalizePublicMapCaseTileManifest(await response.json());

    return manifest ?? createVectorFallbackMapCaseTileManifest();
  } catch (error) {
    console.error("Impossible de charger le manifeste des tuiles de cases.", error);
    return createVectorFallbackMapCaseTileManifest();
  }
}

export function createCdtmBackgroundLayer(
  manifest: PublicMapBackgroundManifest = createDefaultMapBackgroundManifest(
    shouldUseStaticMapBackground() ? "static" : "tiles",
  ),
) {
  if (
    manifest.mode === "tiles" &&
    manifest.tileUrlTemplate &&
    !shouldUseStaticMapBackground()
  ) {
    return new TileLayer({
      extent: MAP_EXTENT,
      source: new ImageTileSource({
        projection: cdtmProjection,
        tileGrid: new TileGrid({
          extent: MAP_EXTENT,
          minZoom: manifest.minZoom,
          origin: [MAP_EXTENT[0], MAP_EXTENT[3]],
          resolutions: manifest.resolutions,
          tileSize: manifest.tileSize,
        }),
        url: (z, x, y) => formatMapTileUrl(manifest.tileUrlTemplate!, z, x, y),
        wrapX: false,
        transition: 0,
      }),
    });
  }

  return new ImageLayer({
    source: new ImageStatic({
      url: manifest.imageUrl ?? MAP_BACKGROUND_PATH,
      imageExtent: MAP_EXTENT,
      projection: cdtmProjection,
    }),
  });
}

function createCdtmCaseRasterTileLayer({
  manifest,
  getDisplayMode,
  visible,
  maxZoom,
  opacity = 1,
  preload = MAP_CASE_TILE_PRELOAD_LEVELS,
  transition = MAP_CASE_TILE_TRANSITION_MS,
}: {
  manifest: PublicMapCaseTileManifest | null;
  getDisplayMode: () => MapDisplayMode;
  visible: boolean;
  maxZoom?: number;
  opacity?: number;
  preload?: number;
  transition?: number;
}) {
  if (
    !manifest ||
    manifest.mode !== "raster" ||
    shouldUseVectorCaseTiles()
  ) {
    return null;
  }

  const safeMaxZoom =
    typeof maxZoom === "number" && Number.isFinite(maxZoom)
      ? Math.min(Math.max(maxZoom, manifest.minZoom), manifest.maxZoom)
      : manifest.maxZoom;
  const resolutionCount = safeMaxZoom - manifest.minZoom + 1;
  const resolutions = manifest.resolutions.slice(0, resolutionCount);

  return new TileLayer({
    cacheSize: MAP_CASE_TILE_CACHE_SIZE,
    extent: MAP_EXTENT,
    opacity,
    preload,
    useInterimTilesOnError: true,
    visible,
    source: new ImageTileSource({
      projection: cdtmProjection,
      tileGrid: new TileGrid({
        extent: MAP_EXTENT,
        minZoom: manifest.minZoom,
        origin: [MAP_EXTENT[0], MAP_EXTENT[3]],
        resolutions,
        tileSize: manifest.tileSize,
      }),
      interpolate: true,
      url: (z, x, y) => {
        const mode = normalizeMapDisplayMode(getDisplayMode());
        const template = manifest.tileUrlTemplates[mode];

        return formatMapTileUrl(template, z, x, y);
      },
      wrapX: false,
      transition,
      zDirection: -1,
    }),
  });
}

export function createCdtmCaseRasterLayer({
  manifest,
  getDisplayMode,
  visible,
}: {
  manifest: PublicMapCaseTileManifest | null;
  getDisplayMode: () => MapDisplayMode;
  visible: boolean;
}) {
  return createCdtmCaseRasterTileLayer({
    manifest,
    getDisplayMode,
    visible,
  });
}

export function createCdtmCaseRasterBackupLayer({
  manifest,
  getDisplayMode,
  visible,
}: {
  manifest: PublicMapCaseTileManifest | null;
  getDisplayMode: () => MapDisplayMode;
  visible: boolean;
}) {
  return createCdtmCaseRasterTileLayer({
    manifest,
    getDisplayMode,
    visible,
    maxZoom: MAP_CASE_TILE_BACKUP_MAX_ZOOM,
    opacity: MAP_CASE_TILE_BACKUP_IDLE_OPACITY,
    preload: MAP_CASE_TILE_PRELOAD_LEVELS,
    transition: 0,
  });
}

export function refreshCdtmCaseRasterLayer(
  layer: ReturnType<typeof createCdtmCaseRasterLayer>,
): void {
  layer?.getSource()?.refresh();
}

export function preloadCdtmBackgroundImage(): Promise<void> {
  if (backgroundImagePreloadPromise) {
    return backgroundImagePreloadPromise;
  }

  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  backgroundImagePreloadPromise = new Promise((resolve) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => {
      if (typeof image.decode === "function") {
        void image.decode().then(resolve).catch(resolve);
        return;
      }

      resolve();
    };
    image.onerror = () => resolve();
    image.src = MAP_BACKGROUND_PATH;

    if (image.complete) {
      if (typeof image.decode === "function") {
        void image.decode().then(resolve).catch(resolve);
        return;
      }

      resolve();
    }
  });

  return backgroundImagePreloadPromise;
}

export function createCdtmMap(target: HTMLElement, layers: BaseLayer[]) {
  return new Map({
    target,
    layers,
    controls: defaultControls({
      attribution: false,
      rotate: false,
    }),
    interactions: defaultInteractions({
      zoomDuration: 0,
    }),
    view: createCdtmView(),
  });
}

export function fitCdtmCasesExtent(map: Map, duration = 0) {
  map.getView().fit(CASES_EXTENT, {
    duration,
    padding: MAP_FIT_PADDING,
    maxZoom: MAP_MAX_ZOOM,
  });
}
