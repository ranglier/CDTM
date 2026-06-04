import crypto from "node:crypto";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  CASE_TILE_DISPLAY_MODES,
  getExpectedMapCaseTileCount,
  getMapCaseTilePlan,
  type CaseTileDisplayMode,
} from "@/map/case-tiles";
import {
  CONTROL_SPLIT_OVERLAY_ALPHA,
  TRANSPARENT_CONTROL_COLOR,
  generateControlSplitPrimitives,
  generatePatternPrimitives,
  getPatternSpec,
  getCasePatternOverlays,
  resolveCaseBaseStyle,
  resolveCaseControlSplitOverlay,
  type MapExtent,
} from "@/map/case-patterns";
import {
  MAP_BACKGROUND_HEIGHT,
  MAP_BACKGROUND_WIDTH,
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "@/map/config";
import {
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  isStableCaseFeatureCollection,
} from "@/map/types";
import { getPublicCaseIndexResponse } from "@/server/public-repository";
import { getServerEnv } from "@/server/env";

export const MAP_CASE_TILE_GENERATOR_VERSION = "case-raster-v1";

const MAP_CASE_TILES_UPLOAD_SUBDIR = "map-case-tiles";
const DEFAULT_CASE_FILL = "rgba(0, 0, 0, 0)";
const DEFAULT_CASE_STROKE = "#000000";
const DEFAULT_CASE_STROKE_WIDTH = 1.2;

type StableJson =
  | null
  | string
  | number
  | boolean
  | StableJson[]
  | { [key: string]: StableJson };

type PreparedCaseFeature = {
  idCase: string;
  properties: StableCaseProperties;
  extent: MapExtent;
  pathData: string;
};

type RenderTileOptions = {
  mode: CaseTileDisplayMode;
  z: number;
  resolution: number;
  column: number;
  row: number;
  tileWorldSize: number;
  features: PreparedCaseFeature[];
  styles: PublicMapStyles;
  targetPath: string;
};

export type MapCaseTileState = {
  stateHash: string;
  collection: StableCaseFeatureCollection;
  publicCasesById: Record<string, StableCaseProperties>;
  styles: PublicMapStyles;
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

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.parseFloat(value.toFixed(3)).toString();
}

function mapYToSvgY(mapY: number): number {
  return -mapY;
}

function pointToSvgPathCoordinate(point: [number, number]): string {
  return `${formatNumber(point[0])} ${formatNumber(mapYToSvgY(point[1]))}`;
}

function mapPointArrayToSvgPoints(points: Array<[number, number]>): string {
  return points.map(pointToSvgPathCoordinate).join(" ");
}

function lineToSvgElement({
  from,
  to,
  color,
  width,
}: {
  from: [number, number];
  to: [number, number];
  color: string;
  width: number;
}): string {
  return `<line x1="${formatNumber(from[0])}" y1="${formatNumber(
    mapYToSvgY(from[1]),
  )}" x2="${formatNumber(to[0])}" y2="${formatNumber(
    mapYToSvgY(to[1]),
  )}" stroke="${escapeXml(color)}" stroke-width="${formatNumber(width)}" stroke-linecap="round"/>`;
}

function dotToSvgElement({
  center,
  color,
  radius,
}: {
  center: [number, number];
  color: string;
  radius: number;
}): string {
  return `<circle cx="${formatNumber(center[0])}" cy="${formatNumber(
    mapYToSvgY(center[1]),
  )}" r="${formatNumber(radius)}" fill="${escapeXml(color)}"/>`;
}

function extentIntersects(left: MapExtent, right: MapExtent): boolean {
  return !(
    left[2] < right[0] ||
    left[0] > right[2] ||
    left[3] < right[1] ||
    left[1] > right[3]
  );
}

function getTileExtent({
  column,
  row,
  tileWorldSize,
}: {
  column: number;
  row: number;
  tileWorldSize: number;
}): MapExtent {
  return [
    MAP_EXTENT[0] + column * tileWorldSize,
    MAP_EXTENT[3] - (row + 1) * tileWorldSize,
    MAP_EXTENT[0] + (column + 1) * tileWorldSize,
    MAP_EXTENT[3] - row * tileWorldSize,
  ];
}

function getFeatureLookupId(properties: StableCaseProperties): string {
  return properties.registry_id_case ?? properties.id_case;
}

function mergeCaseProperties(
  fallback: StableCaseProperties,
  publicCasesById: Record<string, StableCaseProperties>,
): StableCaseProperties {
  const lookupId = getFeatureLookupId(fallback);
  const publicProperties =
    publicCasesById[lookupId] ?? publicCasesById[fallback.id_case];

  return publicProperties
    ? {
        ...fallback,
        ...publicProperties,
        registry_id_case: lookupId,
      }
    : {
        ...fallback,
        registry_id_case: lookupId,
      };
}

function getGeometryRings(
  geometry: StableCaseFeatureCollection["features"][number]["geometry"],
): number[][][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates;
  }

  return geometry.coordinates.flat();
}

function getFeatureExtent(rings: number[][][]): MapExtent {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const ring of rings) {
    for (const point of ring) {
      const [x, y] = point;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return [
    Number.isFinite(minX) ? minX : 0,
    Number.isFinite(minY) ? minY : 0,
    Number.isFinite(maxX) ? maxX : 0,
    Number.isFinite(maxY) ? maxY : 0,
  ];
}

function ringToPathData(ring: number[][]): string {
  const points = ring.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );

  if (points.length === 0) {
    return "";
  }

  const [first, ...rest] = points;

  return [
    `M ${pointToSvgPathCoordinate(first)}`,
    ...rest.map((point) => `L ${pointToSvgPathCoordinate(point)}`),
    "Z",
  ].join(" ");
}

function geometryToPathData(
  geometry: StableCaseFeatureCollection["features"][number]["geometry"],
): string {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringToPathData).join(" ");
  }

  return geometry.coordinates
    .map((polygon) => polygon.map(ringToPathData).join(" "))
    .join(" ");
}

function prepareCaseFeatures(
  collection: StableCaseFeatureCollection,
  publicCasesById: Record<string, StableCaseProperties>,
): PreparedCaseFeature[] {
  return collection.features.flatMap((feature) => {
    const rings = getGeometryRings(feature.geometry);
    const pathData = geometryToPathData(feature.geometry);

    if (pathData.trim().length === 0) {
      return [];
    }

    const properties = mergeCaseProperties(
      feature.properties,
      publicCasesById,
    );

    return [
      {
        idCase: getFeatureLookupId(properties),
        properties,
        extent: getFeatureExtent(rings),
        pathData,
      },
    ];
  });
}

function renderPatternPrimitives({
  feature,
  mode,
  styles,
  resolution,
}: {
  feature: PreparedCaseFeature;
  mode: CaseTileDisplayMode;
  styles: PublicMapStyles;
  resolution: number;
}): string[] {
  const fragments: string[] = [];
  const overlays = getCasePatternOverlays({
    displayMode: mode,
    properties: feature.properties,
    styles,
  }).filter((overlay) => overlay.type === "pattern");

  for (const overlay of overlays) {
    if (overlay.type !== "pattern") {
      continue;
    }

    const spec = getPatternSpec(overlay.patternType, {
      patternSpacing: overlay.patternSpacing,
      patternLineWidth: overlay.patternLineWidth,
      patternDotRadius: overlay.patternDotRadius,
    });
    const strokeWidth = Math.max(0.5, spec.lineWidth) * resolution;
    const dotRadius = Math.max(0.5, spec.dotRadius) * resolution;
    const primitives = generatePatternPrimitives(overlay.patternType, feature.extent, {
      patternSpacing: overlay.patternSpacing,
      patternLineWidth: overlay.patternLineWidth,
      patternDotRadius: overlay.patternDotRadius,
    });

    for (const primitive of primitives) {
      fragments.push(
        primitive.type === "line"
          ? lineToSvgElement({
              from: primitive.from,
              to: primitive.to,
              color: overlay.patternColor,
              width: strokeWidth,
            })
          : dotToSvgElement({
              center: primitive.center,
              color: overlay.patternColor,
              radius: dotRadius,
            }),
      );
    }
  }

  return fragments;
}

function renderControlSplitOverlay({
  feature,
  mode,
  styles,
  clipId,
  tileSvgExtent,
  resolution,
}: {
  feature: PreparedCaseFeature;
  mode: CaseTileDisplayMode;
  styles: PublicMapStyles;
  clipId: string;
  tileSvgExtent: { minX: number; minY: number; width: number; height: number };
  resolution: number;
}): string[] {
  const overlay = resolveCaseControlSplitOverlay(
    mode,
    feature.properties,
    styles,
  );

  if (!overlay) {
    return [];
  }

  const fragments: string[] = [
    `<rect x="${formatNumber(tileSvgExtent.minX)}" y="${formatNumber(
      tileSvgExtent.minY,
    )}" width="${formatNumber(tileSvgExtent.width)}" height="${formatNumber(
      tileSvgExtent.height,
    )}" fill="${escapeXml(overlay.primaryColor)}" clip-path="url(#${clipId})"/>`,
  ];
  const primitives = generateControlSplitPrimitives(overlay, feature.extent);
  const secondaryColor = overlay.secondaryColor;
  const secondaryOpacity =
    secondaryColor === TRANSPARENT_CONTROL_COLOR ? 0 : CONTROL_SPLIT_OVERLAY_ALPHA;
  const spec = getPatternSpec(overlay.patternType, overlay);
  const dotRadius = Math.max(0.5, spec.dotRadius) * resolution;

  for (const primitive of primitives) {
    if (primitive.type === "band") {
      fragments.push(
        `<polygon points="${mapPointArrayToSvgPoints(
          primitive.points,
        )}" fill="${escapeXml(secondaryColor)}" opacity="${formatNumber(
          secondaryOpacity,
        )}" clip-path="url(#${clipId})"/>`,
      );
    } else {
      fragments.push(
        dotToSvgElement({
          center: primitive.center,
          color: secondaryColor,
          radius: dotRadius,
        }).replace("/>", ` opacity="${formatNumber(secondaryOpacity)}" clip-path="url(#${clipId})"/>`),
      );
    }
  }

  return fragments;
}

function renderCaseFeature({
  feature,
  mode,
  styles,
  clipId,
  tileSvgExtent,
  resolution,
}: {
  feature: PreparedCaseFeature;
  mode: CaseTileDisplayMode;
  styles: PublicMapStyles;
  clipId: string;
  tileSvgExtent: { minX: number; minY: number; width: number; height: number };
  resolution: number;
}): string {
  const resolved = resolveCaseBaseStyle(mode, feature.properties, styles);
  const controlSplitOverlay = resolveCaseControlSplitOverlay(
    mode,
    feature.properties,
    styles,
  );
  const fill = controlSplitOverlay
    ? DEFAULT_CASE_FILL
    : (resolved?.fill ?? DEFAULT_CASE_FILL);
  const stroke = resolved?.stroke ?? DEFAULT_CASE_STROKE;
  const strokeWidth = DEFAULT_CASE_STROKE_WIDTH * resolution;
  const fragments: string[] = [
    `<clipPath id="${clipId}"><path d="${escapeXml(
      feature.pathData,
    )}" clip-rule="evenodd"/></clipPath>`,
  ];

  if (fill !== DEFAULT_CASE_FILL) {
    fragments.push(
      `<path d="${escapeXml(feature.pathData)}" fill="${escapeXml(
        fill,
      )}" fill-rule="evenodd"/>`,
    );
  }

  fragments.push(
    ...renderControlSplitOverlay({
      feature,
      mode,
      styles,
      clipId,
      tileSvgExtent,
      resolution,
    }),
  );
  fragments.push(
    `<g clip-path="url(#${clipId})">${renderPatternPrimitives({
      feature,
      mode,
      styles,
      resolution,
    }).join("")}</g>`,
  );
  fragments.push(
    `<path d="${escapeXml(feature.pathData)}" fill="none" stroke="${escapeXml(
      stroke,
    )}" stroke-width="${formatNumber(strokeWidth)}" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd"/>`,
  );

  return fragments.join("");
}

async function loadStableCaseFeatureCollection(): Promise<StableCaseFeatureCollection> {
  const filePath = path.join(process.cwd(), "public/data/cases.geojson");
  const fileContents = await readFile(filePath, "utf8");
  const parsed = JSON.parse(fileContents) as StableCaseFeatureCollection;

  if (!isStableCaseFeatureCollection(parsed)) {
    throw new Error(
      "public/data/cases.geojson does not match the stable case schema.",
    );
  }

  return parsed;
}

function buildPublicCaseLookup(
  cases: StableCaseProperties[],
): Record<string, StableCaseProperties> {
  return Object.fromEntries(
    cases.flatMap((publicCase) => {
      const ids = new Set(
        [publicCase.registry_id_case, publicCase.id_case].filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
      );

      return Array.from(ids).map((idCase) => [idCase, publicCase]);
    }),
  );
}

function getStableHashPayload({
  collection,
  publicCases,
  styles,
}: {
  collection: StableCaseFeatureCollection;
  publicCases: StableCaseProperties[];
  styles: PublicMapStyles;
}): StableJson {
  return toStableJson({
    generator: MAP_CASE_TILE_GENERATOR_VERSION,
    constants: {
      extent: MAP_EXTENT,
      width: MAP_BACKGROUND_WIDTH,
      height: MAP_BACKGROUND_HEIGHT,
      tileSize: MAP_TILE_SIZE,
      minZoom: MAP_TILE_MIN_ZOOM,
      maxZoom: MAP_TILE_MAX_ZOOM,
      resolutions: MAP_TILE_RESOLUTIONS,
      modes: CASE_TILE_DISPLAY_MODES,
    },
    casesGeojson: {
      type: collection.type,
      features: collection.features
        .map((feature) => ({
          id: feature.properties.id_case,
          geometry: feature.geometry,
          properties: feature.properties,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    },
    publicCases: [...publicCases].sort((left, right) =>
      getFeatureLookupId(left).localeCompare(getFeatureLookupId(right)),
    ),
    styles,
  });
}

export async function computeMapCaseTileState(): Promise<MapCaseTileState> {
  const [collection, publicIndex] = await Promise.all([
    loadStableCaseFeatureCollection(),
    getPublicCaseIndexResponse(),
  ]);
  const publicCases = publicIndex.cases as StableCaseProperties[];
  const payload = getStableHashPayload({
    collection,
    publicCases,
    styles: publicIndex.styles,
  });
  const stateHash = crypto
    .createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex");

  return {
    stateHash,
    collection,
    publicCasesById: buildPublicCaseLookup(publicCases),
    styles: publicIndex.styles,
  };
}

function buildSvgTile({
  mode,
  z,
  resolution,
  column,
  row,
  tileWorldSize,
  features,
  styles,
}: Omit<RenderTileOptions, "targetPath">): string {
  const tileExtent = getTileExtent({ column, row, tileWorldSize });
  const visibleFeatures = features.filter((feature) =>
    extentIntersects(feature.extent, tileExtent),
  );
  const svgMinX = MAP_EXTENT[0] + column * tileWorldSize;
  const svgMinY = row * tileWorldSize;
  const tileSvgExtent = {
    minX: svgMinX,
    minY: svgMinY,
    width: tileWorldSize,
    height: tileWorldSize,
  };
  const body = visibleFeatures
    .map((feature, index) =>
      renderCaseFeature({
        feature,
        mode,
        styles,
        clipId: `c-${z}-${column}-${row}-${index}`,
        tileSvgExtent,
        resolution,
      }),
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_TILE_SIZE}" height="${MAP_TILE_SIZE}" viewBox="${formatNumber(
    svgMinX,
  )} ${formatNumber(svgMinY)} ${formatNumber(tileWorldSize)} ${formatNumber(
    tileWorldSize,
  )}"><rect width="100%" height="100%" fill="rgba(0,0,0,0)"/>${body}</svg>`;
}

async function renderTile(options: RenderTileOptions): Promise<void> {
  const svg = buildSvgTile(options);

  await mkdir(path.dirname(options.targetPath), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ lossless: true, effort: 4 }).toFile(
    options.targetPath,
  );
}

export function getMapCaseTilesUploadsDir(): string {
  return path.join(getServerEnv().uploadsDir, MAP_CASE_TILES_UPLOAD_SUBDIR);
}

export function getMapCaseTileSetDirectory(idTileSet: string): string {
  return path.join(getMapCaseTilesUploadsDir(), idTileSet);
}

export function getMapCaseTileSetTilesDir(idTileSet: string): string {
  return path.join(getMapCaseTileSetDirectory(idTileSet), "tiles");
}

export function getMapCaseTileSetTilesPublicPath(idTileSet: string): string {
  return `/uploads/map-case-tiles/${idTileSet}/tiles`;
}

export function getMapCaseTileUrlTemplate(
  tilesPath: string,
  mode: CaseTileDisplayMode,
): string {
  return `${tilesPath}/${mode}/{z}/{x}/{y}.webp`;
}

export async function generateMapCaseTiles({
  state,
  outputDir,
}: {
  state: MapCaseTileState;
  outputDir: string;
}): Promise<{ tileCount: number }> {
  const features = prepareCaseFeatures(state.collection, state.publicCasesById);
  const tmpDir = `${outputDir}.tmp`;
  let tileCount = 0;

  await rm(tmpDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  for (const mode of CASE_TILE_DISPLAY_MODES) {
    for (const level of getMapCaseTilePlan()) {
      const tileWorldSize = MAP_TILE_SIZE * level.resolution;

      for (let row = 0; row < level.rows; row += 1) {
        for (let column = 0; column < level.columns; column += 1) {
          await renderTile({
            mode,
            z: level.z,
            resolution: level.resolution,
            column,
            row,
            tileWorldSize,
            features,
            styles: state.styles,
            targetPath: path.join(
              tmpDir,
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

export async function assertCompleteMapCaseTiles(tilesDir: string): Promise<void> {
  let tileCount = 0;

  for (const mode of CASE_TILE_DISPLAY_MODES) {
    for (const level of getMapCaseTilePlan()) {
      for (let row = 0; row < level.rows; row += 1) {
        for (let column = 0; column < level.columns; column += 1) {
          const tilePath = path.join(
            tilesDir,
            mode,
            String(level.z),
            String(column),
            `${row}.webp`,
          );
          const tileStat = await stat(tilePath);

          if (!tileStat.isFile()) {
            throw new Error("Tuiles de cases incompletes.");
          }

          tileCount += 1;
        }
      }
    }
  }

  if (tileCount !== getExpectedMapCaseTileCount()) {
    throw new Error("Nombre de tuiles de cases inattendu.");
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

export async function readMapCaseTileUpload({
  idTileSet,
  mode,
  z,
  x,
  filename,
}: {
  idTileSet: string;
  mode: string;
  z: string;
  x: string;
  filename: string;
}): Promise<Buffer> {
  const safeId = assertTileSetId(idTileSet);
  const safeMode = assertTileMode(mode);
  const safeZ = assertTileSegment(z);
  const safeX = assertTileSegment(x);
  const match = /^(\d+)\.webp$/.exec(filename);

  if (!match) {
    throw new Error("Tuile introuvable.");
  }

  const safeY = assertTileSegment(match[1]);
  const absolutePath = path.join(
    getMapCaseTileSetTilesDir(safeId),
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

export const testableMapCaseTilingInternals = {
  mapYToSvgY,
  stableStringify,
};
