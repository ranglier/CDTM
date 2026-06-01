import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import type Geometry from "ol/geom/Geometry";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Icon from "ol/style/Icon";
import RegularShape from "ol/style/RegularShape";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

import type { EditorMapLandmark, EditorMapLocality } from "@/editor/types";
import {
  MAP_POINTS_RENDER_BUFFER,
  MAP_VECTOR_UPDATE_WHILE_ANIMATING,
  MAP_VECTOR_UPDATE_WHILE_INTERACTING,
} from "@/map/config";

type EditorPointFamily = "locality" | "landmark";
type EditorPointRecord =
  | { family: "locality"; locality: EditorMapLocality }
  | { family: "landmark"; landmark: EditorMapLandmark };
type LocalityPointShape = "default" | "fort" | "fortified_city";

type EditorPointsLayerContext = {
  getIconImagePath: (iconKey: string | null) => string | null;
  getLocalityDefaultIconKeyForType: (typeKey: string) => string | null;
  getLandmarkDefaultIconKeyForType: (typeKey: string) => string | null;
  getLandmarkTypeCategory: (typeKey: string) => "landmark" | "unique" | null;
  getDisplayMode?: () => "icons" | "points";
  isFamilyVisible?: (family: EditorPointFamily) => boolean;
};

const publishedLocalityStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "rgba(245, 221, 150, 0.95)" }),
    stroke: new Stroke({ color: "rgba(35, 24, 12, 0.95)", width: 2 }),
  }),
});

const draftLocalityStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(245, 221, 150, 0.45)" }),
    stroke: new Stroke({ color: "rgba(35, 24, 12, 0.75)", width: 1.5 }),
  }),
});

const archivedLocalityStyle = new Style({
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: "rgba(160, 160, 160, 0.45)" }),
    stroke: new Stroke({ color: "rgba(35, 35, 35, 0.6)", width: 1 }),
  }),
});

const publishedLandmarkStyle = new Style({
  image: new RegularShape({
    points: 4,
    radius: 7,
    angle: Math.PI / 4,
    fill: new Fill({ color: "rgba(238, 196, 104, 0.95)" }),
    stroke: new Stroke({ color: "rgba(42, 30, 12, 0.95)", width: 2 }),
  }),
});

const draftLandmarkStyle = new Style({
  image: new RegularShape({
    points: 4,
    radius: 6,
    angle: Math.PI / 4,
    fill: new Fill({ color: "rgba(238, 196, 104, 0.5)" }),
    stroke: new Stroke({ color: "rgba(42, 30, 12, 0.8)", width: 1.5 }),
  }),
});

const archivedLandmarkStyle = new Style({
  image: new RegularShape({
    points: 4,
    radius: 5,
    angle: Math.PI / 4,
    fill: new Fill({ color: "rgba(160, 160, 160, 0.42)" }),
    stroke: new Stroke({ color: "rgba(35, 35, 35, 0.6)", width: 1 }),
  }),
});

const publishedUniqueStyle = new Style({
  image: new RegularShape({
    points: 4,
    radius: 7,
    angle: 0,
    fill: new Fill({ color: "rgba(170, 214, 255, 0.95)" }),
    stroke: new Stroke({ color: "rgba(16, 42, 74, 0.95)", width: 2 }),
  }),
});

const draftUniqueStyle = new Style({
  image: new RegularShape({
    points: 4,
    radius: 6,
    angle: 0,
    fill: new Fill({ color: "rgba(170, 214, 255, 0.5)" }),
    stroke: new Stroke({ color: "rgba(16, 42, 74, 0.8)", width: 1.5 }),
  }),
});

const archivedUniqueStyle = new Style({
  image: new RegularShape({
    points: 4,
    radius: 5,
    angle: 0,
    fill: new Fill({ color: "rgba(160, 160, 160, 0.42)" }),
    stroke: new Stroke({ color: "rgba(35, 35, 35, 0.6)", width: 1 }),
  }),
});

const iconStyleCache = new Map<string, Style[]>();
const localityShapeStyleCache = new Map<string, Style>();
const MIN_ICON_SCALE = 0.28;
const MAX_ICON_SCALE = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getIconScaleForResolution(resolution: number): number {
  const safeResolution =
    Number.isFinite(resolution) && resolution > 0 ? resolution : 1;
  return clamp(
    1 / Math.sqrt(Math.max(safeResolution, 1)),
    MIN_ICON_SCALE,
    MAX_ICON_SCALE,
  );
}

function getScaleBucket(scale: number): number {
  return Math.round(scale * 100) / 100;
}

function normalizeObjectTypeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getLocalityPointShape(typeKey: string): LocalityPointShape {
  const normalizedTypeKey = normalizeObjectTypeKey(typeKey);

  if (
    normalizedTypeKey.includes("cite") &&
    (normalizedTypeKey.includes("fortifie") ||
      normalizedTypeKey.includes("fortified") ||
      normalizedTypeKey.includes("forteresse"))
  ) {
    return "fortified_city";
  }

  if (normalizedTypeKey === "fort") {
    return "fort";
  }

  return "default";
}

function isEditorMapLocality(value: unknown): value is EditorMapLocality {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id_locality === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type_key === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.status === "string"
  );
}

function isEditorMapLandmark(value: unknown): value is EditorMapLandmark {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id_landmark === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type_key === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.status === "string"
  );
}

function createPointFeature(point: EditorPointRecord): Feature<Point> {
  if (point.family === "locality") {
    const feature = new Feature<Point>({
      geometry: new Point([point.locality.x, point.locality.y]),
      family: "locality",
      locality: point.locality,
    });
    feature.setId(`locality:${point.locality.id_locality}`);
    return feature;
  }

  const feature = new Feature<Point>({
    geometry: new Point([point.landmark.x, point.landmark.y]),
    family: "landmark",
    landmark: point.landmark,
  });
  feature.setId(`landmark:${point.landmark.id_landmark}`);
  return feature;
}

function getLocalityFallbackStyle(locality: EditorMapLocality | null): Style {
  if (!locality) {
    return publishedLocalityStyle;
  }
  const pointShape = getLocalityPointShape(locality.type_key);

  if (pointShape !== "default") {
    return getLocalityShapeStyle(pointShape, locality.status);
  }

  if (locality.status === "draft") {
    return draftLocalityStyle;
  }
  if (locality.status === "archived") {
    return archivedLocalityStyle;
  }
  return publishedLocalityStyle;
}

function getLocalityShapeStyle(
  pointShape: Exclude<LocalityPointShape, "default">,
  status: EditorMapLocality["status"],
): Style {
  const cacheKey = `${pointShape}:${status}`;
  const cached = localityShapeStyleCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const fillColor =
    status === "archived"
      ? "rgba(160, 160, 160, 0.45)"
      : status === "draft"
        ? "rgba(245, 221, 150, 0.5)"
        : "rgba(245, 221, 150, 0.95)";
  const strokeColor =
    status === "archived"
      ? "rgba(35, 35, 35, 0.6)"
      : status === "draft"
        ? "rgba(35, 24, 12, 0.8)"
        : "rgba(35, 24, 12, 0.95)";
  const strokeWidth = status === "archived" ? 1 : status === "draft" ? 1.5 : 2;
  const radius = status === "archived" ? 5 : status === "draft" ? 6 : 7;

  const style = new Style({
    image:
      pointShape === "fortified_city"
        ? new RegularShape({
            points: 8,
            radius: radius + 2,
            radius2: Math.max(4, radius * 0.58),
            angle: Math.PI / 8,
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
          })
        : new RegularShape({
            points: 4,
            radius: radius + 1,
            angle: 0,
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
          }),
  });

  localityShapeStyleCache.set(cacheKey, style);
  return style;
}

function getLandmarkFallbackStyle(
  landmark: EditorMapLandmark | null,
  category: "landmark" | "unique" | null,
): Style {
  const effectiveCategory = category ?? "landmark";
  if (effectiveCategory === "unique") {
    if (landmark?.status === "draft") return draftUniqueStyle;
    if (landmark?.status === "archived") return archivedUniqueStyle;
    return publishedUniqueStyle;
  }
  if (landmark?.status === "draft") return draftLandmarkStyle;
  if (landmark?.status === "archived") return archivedLandmarkStyle;
  return publishedLandmarkStyle;
}

function createIconStyles(
  iconSource: string,
  status: EditorMapLocality["status"] | EditorMapLandmark["status"],
  resolution: number,
): Style[] {
  const opacity = status === "archived" ? 0.45 : status === "draft" ? 0.75 : 1;
  const scaleBucket = getScaleBucket(getIconScaleForResolution(resolution));
  const hitRadius = Math.max(9, 17 * scaleBucket);
  return [
    new Style({
      image: new CircleStyle({
        radius: hitRadius,
        fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
      }),
    }),
    new Style({
      image: new Icon({
        src: iconSource,
        opacity,
        scale: scaleBucket,
        anchor: [0.5, 0.5],
        ...(iconSource.startsWith("data:")
          ? {}
          : {
              crossOrigin: "anonymous" as const,
            }),
      }),
    }),
  ];
}

function getCachedIconStyles(
  iconSource: string,
  status: EditorMapLocality["status"] | EditorMapLandmark["status"],
  resolution: number,
): Style[] {
  const scaleBucket = getScaleBucket(getIconScaleForResolution(resolution));
  const key = `${iconSource}:${status}:${scaleBucket}`;
  const cached = iconStyleCache.get(key);
  if (cached) {
    return cached;
  }
  const styles = createIconStyles(iconSource, status, resolution);
  iconStyleCache.set(key, styles);
  return styles;
}

function getPointStyleWithContext(
  feature: Feature<Geometry>,
  context?: EditorPointsLayerContext,
  resolution = 1,
): Style | Style[] | null {
  const family = getEditorPointFamilyFromFeature(feature);

  if (!family) {
    return null;
  }

  if (context?.isFamilyVisible && !context.isFamilyVisible(family)) {
    return null;
  }

  if (family === "locality") {
    const locality = getEditorLocalityFromPointFeature(feature);
    const fallbackStyle = getLocalityFallbackStyle(locality);
    if (!locality) {
      return fallbackStyle;
    }
    if (context?.getDisplayMode?.() === "points") {
      return fallbackStyle;
    }
    const effectiveIconKey =
      locality.icon_key ??
      context?.getLocalityDefaultIconKeyForType(locality.type_key) ??
      null;
    const iconSource = context?.getIconImagePath(effectiveIconKey) ?? null;
    return iconSource
      ? getCachedIconStyles(iconSource, locality.status, resolution)
      : fallbackStyle;
  }

  const landmark = getEditorLandmarkFromPointFeature(feature);
  const category = landmark
    ? (context?.getLandmarkTypeCategory(landmark.type_key) ?? "landmark")
    : "landmark";
  const fallbackStyle = getLandmarkFallbackStyle(landmark, category);
  if (!landmark) {
    return fallbackStyle;
  }
  if (context?.getDisplayMode?.() === "points") {
    return fallbackStyle;
  }
  const effectiveIconKey =
    landmark.icon_key ??
    context?.getLandmarkDefaultIconKeyForType(landmark.type_key) ??
    null;
  const iconSource = context?.getIconImagePath(effectiveIconKey) ?? null;
  return iconSource
    ? getCachedIconStyles(iconSource, landmark.status, resolution)
    : fallbackStyle;
}

export function createEditorPointsVectorSource(): VectorSource {
  return new VectorSource();
}

export function createEditorPointsVectorLayer(
  source: VectorSource,
  options: {
    visible?: boolean;
    context?: EditorPointsLayerContext;
    renderBuffer?: number;
    updateWhileAnimating?: boolean;
    updateWhileInteracting?: boolean;
  } = {},
): VectorLayer {
  return new VectorLayer({
    source,
    visible: options.visible ?? true,
    renderBuffer: options.renderBuffer ?? MAP_POINTS_RENDER_BUFFER,
    updateWhileAnimating:
      options.updateWhileAnimating ?? MAP_VECTOR_UPDATE_WHILE_ANIMATING,
    updateWhileInteracting:
      options.updateWhileInteracting ?? MAP_VECTOR_UPDATE_WHILE_INTERACTING,
    style: (feature, resolution) => {
      if (!(feature instanceof Feature)) {
        return undefined;
      }
      return (
        getPointStyleWithContext(
          feature as Feature<Geometry>,
          options.context,
          resolution,
        ) ?? undefined
      );
    },
  });
}

export function replaceEditorPointFeatures(
  source: VectorSource,
  payload: { localities: EditorMapLocality[]; landmarks: EditorMapLandmark[] },
): void {
  source.clear(true);
  source.addFeatures([
    ...payload.localities.map((locality) =>
      createPointFeature({ family: "locality", locality }),
    ),
    ...payload.landmarks.map((landmark) =>
      createPointFeature({ family: "landmark", landmark }),
    ),
  ]);
}

export function upsertEditorPointFeature(
  source: VectorSource,
  point: EditorPointRecord,
): void {
  const featureId =
    point.family === "locality"
      ? `locality:${point.locality.id_locality}`
      : `landmark:${point.landmark.id_landmark}`;
  const existingFeature = source.getFeatureById(featureId);
  if (existingFeature) {
    source.removeFeature(existingFeature);
  }
  source.addFeature(createPointFeature(point));
}

export function updateEditorPointFeature(
  feature: Feature<Geometry>,
  point: EditorPointRecord,
): void {
  feature.set("family", point.family);
  if (point.family === "locality") {
    feature.set("locality", point.locality);
    feature.unset("landmark", true);
    feature.setId(`locality:${point.locality.id_locality}`);
  } else {
    feature.set("landmark", point.landmark);
    feature.unset("locality", true);
    feature.setId(`landmark:${point.landmark.id_landmark}`);
  }
  feature.changed();
}

export function getEditorPointFeatureCoordinates(
  feature: Feature<Geometry>,
): [number, number] | null {
  const geometry = feature.getGeometry();
  if (!(geometry instanceof Point)) {
    return null;
  }
  const coordinates = geometry.getCoordinates();
  if (coordinates.length < 2) {
    return null;
  }
  return [coordinates[0], coordinates[1]];
}

export function setEditorPointFeatureCoordinates(
  feature: Feature<Geometry>,
  coordinates: [number, number],
): void {
  const geometry = feature.getGeometry();
  if (geometry instanceof Point) {
    geometry.setCoordinates(coordinates);
  }
}

export function syncEditorPointsLayerVisibility(
  layer: VectorLayer | null,
  visible: boolean,
): void {
  if (!layer) return;
  layer.setVisible(visible);
  layer.changed();
}

export function getEditorPointFamilyFromFeature(
  feature: Feature<Geometry>,
): EditorPointFamily | null {
  const family = feature.get("family");
  return family === "locality" || family === "landmark" ? family : null;
}

export function getEditorLocalityFromPointFeature(
  feature: Feature<Geometry>,
): EditorMapLocality | null {
  const locality = feature.get("locality");
  return isEditorMapLocality(locality) ? locality : null;
}

export function getEditorLandmarkFromPointFeature(
  feature: Feature<Geometry>,
): EditorMapLandmark | null {
  const landmark = feature.get("landmark");
  return isEditorMapLandmark(landmark) ? landmark : null;
}
