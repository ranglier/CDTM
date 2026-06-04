import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import type Map from "ol/Map";
import { unByKey } from "ol/Observable";
import type RenderEvent from "ol/render/Event";
import { getRenderPixel } from "ol/render";
import type { EventsKey } from "ol/events";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";

import {
  MAP_CASE_PATTERNS_INTERACTION_MAX_RESOLUTION,
  MAP_CASE_PATTERNS_INTERACTION_MAX_VISIBLE_FEATURES,
  MAP_CASE_PATTERNS_MAX_RESOLUTION,
  MAP_CASE_PATTERNS_MAX_VISIBLE_FEATURES,
} from "@/map/config";
import {
  CONTROL_SPLIT_OVERLAY_ALPHA,
  TRANSPARENT_CONTROL_COLOR,
  generateControlSplitPrimitives,
  generatePatternPrimitives,
  getCasePatternOverlays,
  getPatternSpec,
  type CasePatternOverlay,
  type ControlSplitOverlay,
  type MapExtent,
  type MapPoint,
} from "@/map/case-patterns";
import { resolveCaseFeatureProperties } from "@/map/openlayers/cases-layer";
import {
  createEmptyPublicMapStyles,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";

type CasePatternRendererContext = {
  getDisplayMode: () => MapDisplayMode;
  getCasePropertiesById: () => Record<string, StableCaseProperties>;
  getPublicMapStyles: () => PublicMapStyles;
};

type AttachCasePatternsRendererOptions = {
  map: Map;
  layer: VectorLayer;
  source: VectorSource;
  context: CasePatternRendererContext;
  visible?: boolean;
};

export type CasePatternsRendererHandle = {
  render: () => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

function isCoordinate(value: unknown): value is MapPoint {
  return (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isCanvas2DContext(
  context: unknown,
): context is CanvasRenderingContext2D {
  return (
    typeof context === "object" &&
    context !== null &&
    "beginPath" in context &&
    "clip" in context &&
    "canvas" in context
  );
}

function getGeometryCoordinates(geometry: Geometry): unknown {
  if (!("getCoordinates" in geometry)) {
    return null;
  }

  const candidate = geometry as Geometry & { getCoordinates: () => unknown };

  return candidate.getCoordinates();
}

function getGeometryExtent(geometry: Geometry): MapExtent {
  const extent = geometry.getExtent();

  return [extent[0], extent[1], extent[2], extent[3]];
}

function toRenderPixel(
  map: Map,
  event: RenderEvent,
  coordinate: MapPoint,
): MapPoint {
  const cssPixel = map.getPixelFromCoordinate(coordinate);
  const renderPixel = getRenderPixel(event, cssPixel);

  return [renderPixel[0], renderPixel[1]];
}

function appendRingPath(
  context: CanvasRenderingContext2D,
  ring: MapPoint[],
  toPixel: (coordinate: MapPoint) => MapPoint,
): void {
  if (ring.length === 0) {
    return;
  }

  const first = toPixel(ring[0]);
  context.moveTo(first[0], first[1]);

  for (let index = 1; index < ring.length; index += 1) {
    const point = toPixel(ring[index]);
    context.lineTo(point[0], point[1]);
  }

  context.closePath();
}

function appendGeometryPath(
  context: CanvasRenderingContext2D,
  coordinates: unknown,
  toPixel: (coordinate: MapPoint) => MapPoint,
): void {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (coordinates.every(isCoordinate)) {
    appendRingPath(context, coordinates, toPixel);
    return;
  }

  for (const item of coordinates) {
    appendGeometryPath(context, item, toPixel);
  }
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: MapPoint[],
  toPixel: (coordinate: MapPoint) => MapPoint,
): void {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  appendRingPath(context, points, toPixel);
  context.fill();
}

function drawPatternOverlay(
  context: CanvasRenderingContext2D,
  toPixel: (coordinate: MapPoint) => MapPoint,
  extent: MapExtent,
  patternType: CasePatternOverlay & { type: "pattern" },
): void {
  const spec = getPatternSpec(patternType.patternType, patternType);
  const primitives = generatePatternPrimitives(
    patternType.patternType,
    extent,
    patternType,
  );

  context.strokeStyle = patternType.patternColor;
  context.fillStyle = patternType.patternColor;
  context.lineWidth = Math.max(0.9, spec.lineWidth);
  context.lineCap = "round";

  context.beginPath();

  for (const primitive of primitives) {
    if (primitive.type !== "line") {
      continue;
    }

    const from = toPixel(primitive.from);
    const to = toPixel(primitive.to);
    context.moveTo(from[0], from[1]);
    context.lineTo(to[0], to[1]);
  }

  context.stroke();

  for (const primitive of primitives) {
    if (primitive.type !== "dot") {
      continue;
    }

    const center = toPixel(primitive.center);
    context.beginPath();
    context.arc(
      center[0],
      center[1],
      Math.max(0.9, spec.dotRadius),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawControlSplitOverlay(
  context: CanvasRenderingContext2D,
  toPixel: (coordinate: MapPoint) => MapPoint,
  extent: MapExtent,
  overlay: ControlSplitOverlay,
): void {
  const primitives = generateControlSplitPrimitives(overlay, extent);
  const hasEmptySecondaryBands =
    overlay.secondaryColor === TRANSPARENT_CONTROL_COLOR;

  context.globalAlpha = CONTROL_SPLIT_OVERLAY_ALPHA;

  if (!hasEmptySecondaryBands) {
    context.fillStyle = overlay.primaryColor;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }

  context.fillStyle = hasEmptySecondaryBands
    ? overlay.primaryColor
    : overlay.secondaryColor;

  for (const primitive of primitives) {
    if (primitive.type === "band") {
      fillPolygon(context, primitive.points, toPixel);
      continue;
    }

    const spec = getPatternSpec(overlay.patternType, overlay);
    const center = toPixel(primitive.center);
    context.beginPath();
    context.arc(
      center[0],
      center[1],
      Math.max(0.9, spec.dotRadius),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawCaseOverlay(
  context: CanvasRenderingContext2D,
  map: Map,
  event: RenderEvent,
  geometry: Geometry,
  overlay: CasePatternOverlay,
): void {
  const coordinates = getGeometryCoordinates(geometry);

  if (!coordinates) {
    return;
  }

  const toPixel = (coordinate: MapPoint) =>
    toRenderPixel(map, event, coordinate);
  const extent = getGeometryExtent(geometry);

  context.save();
  context.beginPath();
  appendGeometryPath(context, coordinates, toPixel);
  context.clip("evenodd");

  if (overlay.type === "control-split") {
    drawControlSplitOverlay(context, toPixel, extent, overlay.overlay);
  } else {
    drawPatternOverlay(context, toPixel, extent, overlay);
  }

  context.restore();
}

export function attachCasePatternsRenderer({
  map,
  layer,
  source,
  context,
  visible = true,
}: AttachCasePatternsRendererOptions): CasePatternsRendererHandle {
  let currentVisible = visible;
  let mapMoving = false;

  const render = () => {
    layer.changed();
    map.render();
  };

  const moveStartKey = map.on("movestart", () => {
    mapMoving = true;
  });
  const moveEndKey = map.on("moveend", () => {
    mapMoving = false;
    render();
  });

  const postRenderKey: EventsKey = layer.on("postrender", (rawEvent) => {
    if (!currentVisible) {
      return;
    }

    const event = rawEvent as RenderEvent;

    if (!isCanvas2DContext(event.context)) {
      return;
    }

    const extent =
      event.frameState?.extent ?? map.getView().calculateExtent(map.getSize());
    const resolution =
      event.frameState?.viewState.resolution ??
      map.getView().getResolution() ??
      Number.POSITIVE_INFINITY;

    const maxResolution = mapMoving
      ? MAP_CASE_PATTERNS_INTERACTION_MAX_RESOLUTION
      : MAP_CASE_PATTERNS_MAX_RESOLUTION;
    const maxVisibleFeatures = mapMoving
      ? MAP_CASE_PATTERNS_INTERACTION_MAX_VISIBLE_FEATURES
      : MAP_CASE_PATTERNS_MAX_VISIBLE_FEATURES;

    if (resolution > maxResolution) {
      return;
    }

    const visibleFeatures = source.getFeaturesInExtent(extent);

    if (visibleFeatures.length > maxVisibleFeatures) {
      return;
    }

    const casePropertiesById = context.getCasePropertiesById();
    const styles = context.getPublicMapStyles() ?? createEmptyPublicMapStyles();
    const displayMode = context.getDisplayMode();

    for (const candidateFeature of visibleFeatures) {
      if (!(candidateFeature instanceof Feature)) {
        continue;
      }

      const geometry = (candidateFeature as Feature<Geometry>).getGeometry();

      if (!geometry) {
        continue;
      }

      const properties = resolveCaseFeatureProperties(
        candidateFeature as Feature<Geometry>,
        casePropertiesById,
      );
      const overlays = getCasePatternOverlays({
        displayMode,
        properties,
        styles,
      });

      for (const overlay of overlays) {
        drawCaseOverlay(event.context, map, event, geometry, overlay);
      }
    }
  });

  return {
    render,
    setVisible: (nextVisible) => {
      currentVisible = nextVisible;
      render();
    },
    dispose: () => {
      unByKey(postRenderKey);
      unByKey(moveStartKey);
      unByKey(moveEndKey);
    },
  };
}
