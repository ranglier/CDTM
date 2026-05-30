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

import type { EditorMapLandmark } from "@/editor/types";

type EditorLandmarksLayerContext = {
  getIconImagePath: (iconKey: string | null) => string | null;
  getDefaultIconKeyForType: (typeKey: string) => string | null;
  getTypeCategory: (typeKey: string) => "landmark" | "unique" | null;
};

const publishedLandmarkFallback = new Style({
  image: new RegularShape({
    points: 4,
    radius: 7,
    angle: Math.PI / 4,
    fill: new Fill({ color: "rgba(238, 196, 104, 0.95)" }),
    stroke: new Stroke({ color: "rgba(42, 30, 12, 0.95)", width: 2 }),
  }),
});

const draftLandmarkFallback = new Style({
  image: new RegularShape({
    points: 4,
    radius: 6,
    angle: Math.PI / 4,
    fill: new Fill({ color: "rgba(238, 196, 104, 0.5)" }),
    stroke: new Stroke({ color: "rgba(42, 30, 12, 0.8)", width: 1.5 }),
  }),
});

const archivedLandmarkFallback = new Style({
  image: new RegularShape({
    points: 4,
    radius: 5,
    angle: Math.PI / 4,
    fill: new Fill({ color: "rgba(160, 160, 160, 0.42)" }),
    stroke: new Stroke({ color: "rgba(35, 35, 35, 0.6)", width: 1 }),
  }),
});

const publishedUniqueFallback = new Style({
  image: new RegularShape({
    points: 4,
    radius: 7,
    angle: 0,
    fill: new Fill({ color: "rgba(170, 214, 255, 0.95)" }),
    stroke: new Stroke({ color: "rgba(16, 42, 74, 0.95)", width: 2 }),
  }),
});

const draftUniqueFallback = new Style({
  image: new RegularShape({
    points: 4,
    radius: 6,
    angle: 0,
    fill: new Fill({ color: "rgba(170, 214, 255, 0.5)" }),
    stroke: new Stroke({ color: "rgba(16, 42, 74, 0.8)", width: 1.5 }),
  }),
});

const archivedUniqueFallback = new Style({
  image: new RegularShape({
    points: 4,
    radius: 5,
    angle: 0,
    fill: new Fill({ color: "rgba(160, 160, 160, 0.42)" }),
    stroke: new Stroke({ color: "rgba(35, 35, 35, 0.6)", width: 1 }),
  }),
});

const iconStyleCache = new Map<string, Style[]>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getIconScaleForResolution(resolution: number): number {
  const safeResolution = Number.isFinite(resolution) && resolution > 0 ? resolution : 1;
  return clamp(1 / Math.sqrt(Math.max(safeResolution, 1)), 0.4, 1);
}

function getScaleBucket(scale: number): number {
  return Math.round(scale * 100) / 100;
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

function createLandmarkFeature(landmark: EditorMapLandmark): Feature<Point> {
  const feature = new Feature<Point>({
    geometry: new Point([landmark.x, landmark.y]),
    landmark,
  });

  feature.setId(landmark.id_landmark);

  return feature;
}

function getFallbackStyle(
  landmark: EditorMapLandmark | null,
  category: "landmark" | "unique" | null,
): Style {
  const effectiveCategory = category ?? "landmark";

  if (effectiveCategory === "unique") {
    if (landmark?.status === "draft") {
      return draftUniqueFallback;
    }

    if (landmark?.status === "archived") {
      return archivedUniqueFallback;
    }

    return publishedUniqueFallback;
  }

  if (landmark?.status === "draft") {
    return draftLandmarkFallback;
  }

  if (landmark?.status === "archived") {
    return archivedLandmarkFallback;
  }

  return publishedLandmarkFallback;
}

function createIconStyles(
  iconSource: string,
  landmark: EditorMapLandmark,
  resolution: number,
): Style[] {
  const opacity =
    landmark.status === "archived" ? 0.45 : landmark.status === "draft" ? 0.75 : 1;
  const scale = getIconScaleForResolution(resolution);
  const scaleBucket = getScaleBucket(scale);
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

function getIconStyles(
  iconSource: string,
  landmark: EditorMapLandmark,
  resolution: number,
): Style[] {
  const scaleBucket = getScaleBucket(getIconScaleForResolution(resolution));
  const key = `${iconSource}:${landmark.status}:${scaleBucket}`;
  const cached = iconStyleCache.get(key);

  if (cached) {
    return cached;
  }

  const styles = createIconStyles(iconSource, landmark, resolution);
  iconStyleCache.set(key, styles);
  return styles;
}

function getLandmarkStyleWithContext(
  feature: Feature<Geometry>,
  context?: EditorLandmarksLayerContext,
  resolution = 1,
): Style | Style[] {
  const landmark = getEditorLandmarkFromFeature(feature);
  const category = landmark ? context?.getTypeCategory(landmark.type_key) ?? "landmark" : "landmark";
  const fallbackStyle = getFallbackStyle(landmark, category);

  if (!landmark) {
    return fallbackStyle;
  }

  const effectiveIconKey =
    landmark.icon_key ?? context?.getDefaultIconKeyForType(landmark.type_key) ?? null;
  const iconSource = context?.getIconImagePath(effectiveIconKey) ?? null;

  if (!iconSource) {
    return fallbackStyle;
  }

  return getIconStyles(iconSource, landmark, resolution);
}

export function createEditorLandmarksVectorSource(): VectorSource {
  return new VectorSource();
}

export function createEditorLandmarksVectorLayer(
  source: VectorSource,
  options: { visible?: boolean; context?: EditorLandmarksLayerContext } = {},
): VectorLayer {
  return new VectorLayer({
    source,
    visible: options.visible ?? true,
    style: (feature, resolution) => {
      if (!(feature instanceof Feature)) {
        return undefined;
      }

      return getLandmarkStyleWithContext(
        feature as Feature<Geometry>,
        options.context,
        resolution,
      );
    },
  });
}

export function replaceEditorLandmarkFeatures(
  source: VectorSource,
  landmarks: EditorMapLandmark[],
): void {
  source.clear(true);
  source.addFeatures(landmarks.map(createLandmarkFeature));
}

export function upsertEditorLandmarkFeature(
  source: VectorSource,
  landmark: EditorMapLandmark,
): void {
  const existingFeature = source.getFeatureById(landmark.id_landmark);

  if (existingFeature) {
    source.removeFeature(existingFeature);
  }

  source.addFeature(createLandmarkFeature(landmark));
}

export function syncEditorLandmarksLayerVisibility(
  layer: VectorLayer | null,
  visible: boolean,
): void {
  if (!layer) {
    return;
  }

  layer.setVisible(visible);
  layer.changed();
}

export function getEditorLandmarkFromFeature(
  feature: Feature<Geometry>,
): EditorMapLandmark | null {
  const landmark = feature.get("landmark");

  return isEditorMapLandmark(landmark) ? landmark : null;
}
