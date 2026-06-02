import Feature from "ol/Feature";
import type { FrameState } from "ol/Map";
import type Geometry from "ol/geom/Geometry";
import Layer from "ol/layer/Layer";
import type VectorSource from "ol/source/Vector";
import { apply as applyTransform } from "ol/transform";

import { resolveCaseFeatureProperties } from "@/map/openlayers/cases-layer";
import { getCasePatternOverlays, paintCasePatternOverlay } from "@/map/styles";
import {
  createEmptyPublicMapStyles,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";

type CasePatternLayerContext = {
  getDisplayMode: () => MapDisplayMode;
  getCasePropertiesById: () => Record<string, StableCaseProperties>;
  getPublicMapStyles: () => PublicMapStyles;
};

type CreateCasePatternsLayerOptions = {
  visible?: boolean;
};

type ScreenCoordinate = [number, number];

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function transformCoordinatesToDevicePixels(
  coordinates: unknown,
  frameState: FrameState,
  pixelRatio: number,
): unknown {
  if (isCoordinate(coordinates)) {
    const pixel = applyTransform(frameState.coordinateToPixelTransform, [
      coordinates[0],
      coordinates[1],
    ]) as ScreenCoordinate;

    return [pixel[0] * pixelRatio, pixel[1] * pixelRatio];
  }

  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  return coordinates.map((item) =>
    transformCoordinatesToDevicePixels(item, frameState, pixelRatio),
  );
}

function getGeometryCoordinates(geometry: Geometry): unknown {
  if (!("getCoordinates" in geometry)) {
    return null;
  }

  const candidate = geometry as Geometry & { getCoordinates: () => unknown };

  return candidate.getCoordinates();
}

function resizeCanvasForFrame(
  canvas: HTMLCanvasElement,
  frameState: FrameState,
): CanvasRenderingContext2D | null {
  const pixelRatio = frameState.pixelRatio;
  const width = Math.max(1, Math.round(frameState.size[0] * pixelRatio));
  const height = Math.max(1, Math.round(frameState.size[1] * pixelRatio));

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  const cssWidth = `${frameState.size[0]}px`;
  const cssHeight = `${frameState.size[1]}px`;

  if (canvas.style.width !== cssWidth) {
    canvas.style.width = cssWidth;
  }

  if (canvas.style.height !== cssHeight) {
    canvas.style.height = cssHeight;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

export function createCasePatternsLayer(
  source: VectorSource,
  context: CasePatternLayerContext,
  options: CreateCasePatternsLayerOptions = {},
): Layer {
  let canvas: HTMLCanvasElement | null = null;

  return new Layer({
    visible: options.visible ?? true,
    render: (frameState) => {
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "cdtm-case-patterns-layer";
        canvas.style.position = "absolute";
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.pointerEvents = "none";
      }

      const drawContext = resizeCanvasForFrame(canvas, frameState);

      if (!drawContext) {
        return canvas;
      }

      const features = frameState.extent
        ? source.getFeaturesInExtent(frameState.extent)
        : source.getFeatures();
      const casePropertiesById = context.getCasePropertiesById();
      const styles =
        context.getPublicMapStyles() ?? createEmptyPublicMapStyles();
      const displayMode = context.getDisplayMode();

      for (const candidateFeature of features) {
        if (!(candidateFeature instanceof Feature)) {
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

        if (overlays.length === 0) {
          continue;
        }

        const geometry = (candidateFeature as Feature<Geometry>).getGeometry();

        if (!geometry) {
          continue;
        }

        const coordinates = getGeometryCoordinates(geometry);

        if (!coordinates) {
          continue;
        }

        const screenCoordinates = transformCoordinatesToDevicePixels(
          coordinates,
          frameState,
          frameState.pixelRatio,
        );

        for (const overlay of overlays) {
          paintCasePatternOverlay(
            drawContext,
            screenCoordinates,
            overlay,
            frameState.pixelRatio,
          );
        }
      }

      return canvas;
    },
  });
}

export function syncCasePatternsLayerVisibility(
  layer: Layer | null,
  visible: boolean,
): void {
  if (!layer) {
    return;
  }

  layer.setVisible(visible);
  layer.changed();
}
