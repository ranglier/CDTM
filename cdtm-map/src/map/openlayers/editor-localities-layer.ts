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

const localityIconBadgeStyle = new Style({
  image: new CircleStyle({
    radius: 11,
    fill: new Fill({ color: "rgba(245, 221, 150, 0.92)" }),
    stroke: new Stroke({ color: "rgba(35, 24, 12, 0.9)", width: 1.5 }),
  }),
});

type EditorLocalitiesLayerContext = {
  getIconImagePath: (iconKey: string | null) => string | null;
  getDefaultIconKeyForType: (typeKey: string) => string | null;
};

const iconStyleCache = new Map<string, Style[]>();

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
  imagePath: string,
  locality: EditorMapLocality,
): Style[] {
  const opacity =
    locality.status === "archived" ? 0.45 : locality.status === "draft" ? 0.75 : 1;

  const hitAreaStyle = new Style({
    image: new CircleStyle({
      radius: 14,
      fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    }),
  });

  const iconStyle = new Style({
    image: new Icon({
      src: imagePath,
      opacity,
      scale: 0.055,
      anchor: [0.5, 0.5],
      crossOrigin: "anonymous",
    }),
  });

  return [localityIconBadgeStyle, hitAreaStyle, iconStyle];
}

function getIconStyles(imagePath: string, locality: EditorMapLocality): Style[] {
  const key = `${imagePath}:${locality.status}`;
  const cached = iconStyleCache.get(key);

  if (cached) {
    return cached;
  }

  const styles = createIconStyles(imagePath, locality);
  iconStyleCache.set(key, styles);
  return styles;
}

function getLocalityStyleWithContext(
  feature: Feature<Geometry>,
  context?: EditorLocalitiesLayerContext,
): Style | Style[] {
  const locality = getEditorLocalityFromFeature(feature);
  const fallbackStyle = getFallbackLocalityStyle(locality);

  if (!locality) {
    return fallbackStyle;
  }

  const effectiveIconKey =
    locality.icon_key ?? context?.getDefaultIconKeyForType(locality.type_key) ?? null;
  const imagePath = context?.getIconImagePath(effectiveIconKey) ?? null;

  if (!imagePath) {
    return fallbackStyle;
  }

  return getIconStyles(imagePath, locality);
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
    style: (feature) => {
      if (!(feature instanceof Feature)) {
        return undefined;
      }

      return getLocalityStyleWithContext(feature as Feature<Geometry>, options.context);
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
