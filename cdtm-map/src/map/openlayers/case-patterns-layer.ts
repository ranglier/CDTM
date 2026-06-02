import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import type Map from "ol/Map";
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";
import type VectorSource from "ol/source/Vector";

import { resolveCaseFeatureProperties } from "@/map/openlayers/cases-layer";
import { getCasePatternOverlays, paintCasePatternOverlay } from "@/map/styles";
import {
  createEmptyPublicMapStyles,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";

type CasePatternOverlayContext = {
  getDisplayMode: () => MapDisplayMode;
  getCasePropertiesById: () => Record<string, StableCaseProperties>;
  getPublicMapStyles: () => PublicMapStyles;
};

type AttachCasePatternsOverlayOptions = {
  map: Map;
  source: VectorSource;
  context: CasePatternOverlayContext;
  visible?: boolean;
};

export type CasePatternsOverlayHandle = {
  render: () => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

type ScreenCoordinate = [number, number];

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function getDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  const ratio = window.devicePixelRatio;

  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function transformCoordinatesToDevicePixels(
  coordinates: unknown,
  map: Map,
  pixelRatio: number,
): unknown {
  if (isCoordinate(coordinates)) {
    const pixel = map.getPixelFromCoordinate(coordinates) as ScreenCoordinate;

    return [pixel[0] * pixelRatio, pixel[1] * pixelRatio];
  }

  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  return coordinates.map((item) =>
    transformCoordinatesToDevicePixels(item, map, pixelRatio),
  );
}

function getGeometryCoordinates(geometry: Geometry): unknown {
  if (!("getCoordinates" in geometry)) {
    return null;
  }

  const candidate = geometry as Geometry & { getCoordinates: () => unknown };

  return candidate.getCoordinates();
}

function createOverlayCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = "cdtm-case-patterns-overlay";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  return canvas;
}

function getMapCssSize(map: Map): [number, number] {
  const size = map.getSize();

  if (size) {
    return [Math.max(1, size[0]), Math.max(1, size[1])];
  }

  const rect = map.getViewport().getBoundingClientRect();

  return [Math.max(1, rect.width), Math.max(1, rect.height)];
}

function resizeCanvasForMap(
  canvas: HTMLCanvasElement,
  map: Map,
  pixelRatio: number,
): CanvasRenderingContext2D | null {
  const [cssWidth, cssHeight] = getMapCssSize(map);
  const width = Math.max(1, Math.round(cssWidth * pixelRatio));
  const height = Math.max(1, Math.round(cssHeight * pixelRatio));

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function attachCasePatternsOverlay({
  map,
  source,
  context,
  visible = true,
}: AttachCasePatternsOverlayOptions): CasePatternsOverlayHandle {
  const canvas = createOverlayCanvas();
  const viewport = map.getViewport();
  let disposed = false;
  let currentVisible = visible;
  let mapMoving = false;
  let animationFrame: number | null = null;

  viewport.appendChild(canvas);

  const cancelScheduledRender = () => {
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };

  const draw = () => {
    animationFrame = null;

    if (disposed) {
      return;
    }

    const pixelRatio = getDevicePixelRatio();
    const drawContext = resizeCanvasForMap(canvas, map, pixelRatio);

    if (!drawContext || !currentVisible || mapMoving) {
      return;
    }

    const extent = map.getView().calculateExtent(map.getSize());
    const features = source.getFeaturesInExtent(extent);
    const casePropertiesById = context.getCasePropertiesById();
    const styles = context.getPublicMapStyles() ?? createEmptyPublicMapStyles();
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
        map,
        pixelRatio,
      );

      for (const overlay of overlays) {
        paintCasePatternOverlay(
          drawContext,
          screenCoordinates,
          overlay,
          pixelRatio,
        );
      }
    }
  };

  const scheduleRender = () => {
    if (disposed || animationFrame !== null) {
      return;
    }

    animationFrame = window.requestAnimationFrame(draw);
  };

  const clearAndCancel = () => {
    cancelScheduledRender();
    clearCanvas(canvas);
  };

  const eventKeys: EventsKey[] = [
    map.on("movestart", () => {
      mapMoving = true;
      clearAndCancel();
    }),
    map.on("moveend", () => {
      mapMoving = false;
      scheduleRender();
    }),
    source.on("change", scheduleRender),
  ];

  scheduleRender();

  return {
    render: scheduleRender,
    setVisible: (nextVisible) => {
      currentVisible = nextVisible;

      if (!nextVisible) {
        clearAndCancel();
        return;
      }

      scheduleRender();
    },
    dispose: () => {
      disposed = true;
      cancelScheduledRender();
      for (const key of eventKeys) {
        unByKey(key);
      }
      canvas.remove();
    },
  };
}
