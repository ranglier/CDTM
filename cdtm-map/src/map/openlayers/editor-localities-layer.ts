import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import type Geometry from "ol/geom/Geometry";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Icon from "ol/style/Icon";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

import type { EditorMapLocality } from "@/editor/types";

const publishedStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "rgba(245, 221, 150, 0.95)" }),
    stroke: new Stroke({ color: "rgba(35, 24, 12, 0.95)", width: 2 }),
  }),
});

const draftStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(245, 221, 150, 0.45)" }),
    stroke: new Stroke({ color: "rgba(35, 24, 12, 0.75)", width: 1.5 }),
  }),
});

const archivedStyle = new Style({
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: "rgba(160, 160, 160, 0.45)" }),
    stroke: new Stroke({ color: "rgba(35, 35, 35, 0.6)", width: 1 }),
  }),
});

type EditorLocalitiesLayerContext = {
  getIconImagePath: (iconKey: string | null) => string | null;
  getDefaultIconKeyForType: (typeKey: string) => string | null;
  getDisplayMode?: () => "icons" | "points";
};

const iconStyleCache = new Map<string, Style[]>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getIconScaleForResolution(resolution: number): number {
  const safeResolution = Number.isFinite(resolution) && resolution > 0 ? resolution : 1;
  return clamp(1 / Math.sqrt(Math.max(safeResolution, 1)), 0.45, 1);
}

function getScaleBucket(scale: number): number {
  return Math.round(scale * 100) / 100;
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

function createLocalityFeature(locality: EditorMapLocality): Feature<Point> {
  const feature = new Feature<Point>({
    geometry: new Point([locality.x, locality.y]),
    locality,
  });

  feature.setId(locality.id_locality);

  return feature;
}

function getFallbackLocalityStyle(locality: EditorMapLocality | null): Style {
  if (!locality) {
    return publishedStyle;
  }

  if (locality.status === "draft") {
    return draftStyle;
  }

  if (locality.status === "archived") {
    return archivedStyle;
  }

  return publishedStyle;
}

function createIconStyles(
  iconSource: string,
  locality: EditorMapLocality,
  resolution: number,
): Style[] {
  const opacity =
    locality.status === "archived" ? 0.45 : locality.status === "draft" ? 0.75 : 1;
  const scale = getIconScaleForResolution(resolution);
  const scaleBucket = getScaleBucket(scale);
  const hitRadius = Math.max(8, 16 * scaleBucket);

  const hitAreaStyle = new Style({
    image: new CircleStyle({
      radius: hitRadius,
      fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    }),
  });

  const iconStyle = new Style({
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
  });

  return [hitAreaStyle, iconStyle];
}

function getIconStyles(
  iconSource: string,
  locality: EditorMapLocality,
  resolution: number,
): Style[] {
  const scaleBucket = getScaleBucket(getIconScaleForResolution(resolution));
  const key = `${iconSource}:${locality.status}:${scaleBucket}`;
  const cached = iconStyleCache.get(key);

  if (cached) {
    return cached;
  }

  const styles = createIconStyles(iconSource, locality, resolution);
  iconStyleCache.set(key, styles);
  return styles;
}

function getLocalityStyleWithContext(
  feature: Feature<Geometry>,
  context?: EditorLocalitiesLayerContext,
  resolution = 1,
): Style | Style[] {
  const locality = getEditorLocalityFromFeature(feature);
  const fallbackStyle = getFallbackLocalityStyle(locality);

  if (!locality) {
    return fallbackStyle;
  }

  if (context?.getDisplayMode?.() === "points") {
    return fallbackStyle;
  }

  const effectiveIconKey =
    locality.icon_key ?? context?.getDefaultIconKeyForType(locality.type_key) ?? null;
  const iconSource = context?.getIconImagePath(effectiveIconKey) ?? null;

  if (!iconSource) {
    return fallbackStyle;
  }

  return getIconStyles(iconSource, locality, resolution);
}

export function createEditorLocalitiesVectorSource(): VectorSource {
  return new VectorSource();
}

export function createEditorLocalitiesVectorLayer(
  source: VectorSource,
  options: { visible?: boolean; context?: EditorLocalitiesLayerContext } = {},
): VectorLayer {
  return new VectorLayer({
    source,
    visible: options.visible ?? true,
    style: (feature, resolution) => {
      if (!(feature instanceof Feature)) {
        return undefined;
      }

      return getLocalityStyleWithContext(
        feature as Feature<Geometry>,
        options.context,
        resolution,
      );
    },
  });
}

export function replaceEditorLocalityFeatures(
  source: VectorSource,
  localities: EditorMapLocality[],
): void {
  source.clear(true);
  source.addFeatures(localities.map(createLocalityFeature));
}

export function upsertEditorLocalityFeature(
  source: VectorSource,
  locality: EditorMapLocality,
): void {
  const existingFeature = source.getFeatureById(locality.id_locality);

  if (existingFeature) {
    source.removeFeature(existingFeature);
  }

  source.addFeature(createLocalityFeature(locality));
}

export function updateEditorLocalityFeature(
  feature: Feature<Geometry>,
  locality: EditorMapLocality,
): void {
  feature.set("locality", locality);
  feature.setId(locality.id_locality);
  feature.changed();
}

export function getEditorLocalityFeatureCoordinates(
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

export function setEditorLocalityFeatureCoordinates(
  feature: Feature<Geometry>,
  coordinates: [number, number],
): void {
  const geometry = feature.getGeometry();

  if (geometry instanceof Point) {
    geometry.setCoordinates(coordinates);
  }
}

export function syncEditorLocalitiesLayerVisibility(
  layer: VectorLayer | null,
  visible: boolean,
): void {
  if (!layer) {
    return;
  }

  layer.setVisible(visible);
  layer.changed();
}

export function getEditorLocalityFromFeature(
  feature: Feature<Geometry>,
): EditorMapLocality | null {
  const locality = feature.get("locality");

  return isEditorMapLocality(locality) ? locality : null;
}
