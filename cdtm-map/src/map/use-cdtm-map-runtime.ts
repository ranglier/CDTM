"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import type BaseLayer from "ol/layer/Base";
import type VectorLayer from "ol/layer/Vector";
import type Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";

import { MAP_MAX_ZOOM } from "@/map/config";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  syncCaseLayerVisibility,
} from "@/map/openlayers/cases-layer";
import {
  createEditorPointsVectorLayer,
  createEditorPointsVectorSource,
  syncEditorPointsLayerVisibility,
} from "@/map/openlayers/editor-points-layer";
import {
  createEditorRoutesVectorLayer,
  createEditorRoutesVectorSource,
  syncEditorRoutesLayerVisibility,
} from "@/map/openlayers/editor-routes-layer";
import {
  createCdtmBackgroundLayer,
  createCdtmMap,
  fitCdtmCasesExtent,
  preloadCdtmBackgroundImage,
} from "@/map/openlayers/map-core";
import {
  createEmptyPublicMapStyles,
  normalizeMapDisplayMode,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";

export type CdtmMapHoverInfo = {
  x: number;
  y: number;
  title: string | null;
  rows: Array<{
    label: string;
    value: string;
  }>;
};

export type CdtmMapObjectDisplayMode = "icons" | "points";

type StandardLayers = {
  backgroundLayer: ReturnType<typeof createCdtmBackgroundLayer>;
  casesSource: ReturnType<typeof createCasesVectorSource>;
  casesLayer: ReturnType<typeof createCasesVectorLayer>;
  routesSource: ReturnType<typeof createEditorRoutesVectorSource>;
  routesLayer: ReturnType<typeof createEditorRoutesVectorLayer>;
  pointsSource: ReturnType<typeof createEditorPointsVectorSource>;
  pointsLayer: ReturnType<typeof createEditorPointsVectorLayer>;
};

type RuntimeHandles = Omit<StandardLayers, "backgroundLayer"> & {
  map: Map;
};

type UseCdtmMapRuntimeOptions = {
  activeCaseId: string | null;
  selectedCaseIds: string[];
  casePropertiesById: Record<string, StableCaseProperties>;
  publicMapStyles: PublicMapStyles;
  displayMode: MapDisplayMode;
  casesVisible: boolean;
  localitiesVisible: boolean;
  landmarksVisible: boolean;
  routesVisible: boolean;
  objectDisplayMode: CdtmMapObjectDisplayMode;
  clearHoverRequest?: number;
  onCasesHidden?: () => void;
};

function areStringSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function clearMapCursor(map: Map | null) {
  map?.getTargetElement().style.setProperty("cursor", "");
}

export function isToggleSelectionEvent(event: unknown): boolean {
  return (
    event instanceof MouseEvent &&
    (event.shiftKey || event.ctrlKey || event.metaKey)
  );
}

export function getFeatureAtPixel(
  map: Map,
  event: MapBrowserEvent<PointerEvent>,
  layer: BaseLayer,
  hitTolerance?: number,
): Feature<Geometry> | null {
  const feature = map.forEachFeatureAtPixel(
    event.pixel,
    (candidate) =>
      candidate instanceof Feature ? (candidate as Feature<Geometry>) : null,
    {
      layerFilter: (candidateLayer) => candidateLayer === layer,
      ...(typeof hitTolerance === "number" ? { hitTolerance } : {}),
    },
  );

  return feature instanceof Feature ? feature : null;
}

export function attachCdtmPointerMoveLifecycle({
  map,
  runHitTests,
  clearHover,
}: {
  map: Map;
  runHitTests: (event: MapBrowserEvent<PointerEvent>) => void;
  clearHover: () => void;
}): () => void {
  let mapInteracting = false;
  let pointerMoveFrame: number | null = null;
  let latestPointerMoveEvent: MapBrowserEvent<PointerEvent> | null = null;

  const cancelPointerMoveFrame = () => {
    if (pointerMoveFrame !== null) {
      window.cancelAnimationFrame(pointerMoveFrame);
      pointerMoveFrame = null;
    }

    latestPointerMoveEvent = null;
  };

  const pointerMoveHandler = (rawEvent: unknown) => {
    latestPointerMoveEvent = rawEvent as MapBrowserEvent<PointerEvent>;

    if (pointerMoveFrame !== null) {
      return;
    }

    pointerMoveFrame = window.requestAnimationFrame(() => {
      pointerMoveFrame = null;
      const event = latestPointerMoveEvent;
      latestPointerMoveEvent = null;

      if (!event) {
        return;
      }

      if (mapInteracting) {
        clearHover();
        return;
      }

      runHitTests(event);
    });
  };

  const moveStartKey = map.on("movestart", () => {
    mapInteracting = true;
    cancelPointerMoveFrame();
    clearHover();
  });
  const moveEndKey = map.on("moveend", () => {
    mapInteracting = false;
  });
  const pointerMoveKey = map.on("pointermove", pointerMoveHandler);

  return () => {
    cancelPointerMoveFrame();
    unByKey(pointerMoveKey);
    unByKey(moveStartKey);
    unByKey(moveEndKey);
  };
}

export function createCdtmResizeObserver(map: Map, target: HTMLElement) {
  const resizeObserver = new ResizeObserver(() => {
    map.updateSize();
  });

  resizeObserver.observe(target);
  return resizeObserver;
}

export function useCdtmMapRuntime({
  activeCaseId,
  selectedCaseIds,
  casePropertiesById,
  publicMapStyles,
  displayMode,
  casesVisible,
  localitiesVisible,
  landmarksVisible,
  routesVisible,
  objectDisplayMode,
  clearHoverRequest,
  onCasesHidden,
}: UseCdtmMapRuntimeOptions) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const casesSourceRef = useRef<ReturnType<
    typeof createCasesVectorSource
  > | null>(null);
  const casesLayerRef = useRef<ReturnType<
    typeof createCasesVectorLayer
  > | null>(null);
  const pointsSourceRef = useRef<ReturnType<
    typeof createEditorPointsVectorSource
  > | null>(null);
  const pointsLayerRef = useRef<ReturnType<
    typeof createEditorPointsVectorLayer
  > | null>(null);
  const routesSourceRef = useRef<ReturnType<
    typeof createEditorRoutesVectorSource
  > | null>(null);
  const routesLayerRef = useRef<ReturnType<
    typeof createEditorRoutesVectorLayer
  > | null>(null);
  const casesVisibleRef = useRef(casesVisible);
  const localitiesVisibleRef = useRef(localitiesVisible);
  const landmarksVisibleRef = useRef(landmarksVisible);
  const routesVisibleRef = useRef(routesVisible);
  const activeCaseIdRef = useRef<string | null>(activeCaseId);
  const selectedCaseIdsRef = useRef<Set<string>>(new Set(selectedCaseIds));
  const casePropertiesByIdRef = useRef(casePropertiesById);
  const publicMapStylesRef = useRef<PublicMapStyles>(
    publicMapStyles ?? createEmptyPublicMapStyles(),
  );
  const displayModeRef = useRef<MapDisplayMode>(
    normalizeMapDisplayMode(displayMode),
  );
  const objectDisplayModeRef =
    useRef<CdtmMapObjectDisplayMode>(objectDisplayMode);
  const mapIconSourceByKeyRef = useRef<Record<string, string>>({});
  const localityDefaultIconKeyByTypeRef = useRef<Record<string, string | null>>(
    {},
  );
  const landmarkDefaultIconKeyByTypeRef = useRef<Record<string, string | null>>(
    {},
  );
  const landmarkCategoryByTypeRef = useRef<
    Record<string, "landmark" | "unique" | null>
  >({});
  const [hoverInfo, setHoverInfo] = useState<CdtmMapHoverInfo | null>(null);

  const clearHover = useCallback(() => {
    clearMapCursor(mapRef.current);
    setHoverInfo(null);
  }, []);

  const getTooltipPosition = useCallback(
    (
      originalEvent: PointerEvent,
      options: { width?: number; height?: number } = {},
    ): { x: number; y: number } => {
      const viewportWidth =
        typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 0;
      const preferredX = originalEvent.clientX + 18;
      const preferredY = originalEvent.clientY + 18;
      const tooltipWidth = options.width ?? 260;
      const tooltipHeight = options.height ?? 140;

      return {
        x:
          viewportWidth > 0
            ? Math.min(preferredX, viewportWidth - tooltipWidth)
            : preferredX,
        y:
          viewportHeight > 0
            ? Math.min(preferredY, viewportHeight - tooltipHeight)
            : preferredY,
      };
    },
    [],
  );

  const showTooltipAtCoordinate = useCallback(
    (
      coordinate: [number, number],
      title: string | null,
      rows: CdtmMapHoverInfo["rows"],
    ) => {
      const map = mapRef.current;

      if (!map) {
        return;
      }

      const pixel = map.getPixelFromCoordinate(coordinate);
      const mapRect = map.getTargetElement().getBoundingClientRect();
      const tooltipWidth = 260;
      const tooltipHeight =
        rows.length === 0 ? 72 : rows.length > 2 ? 180 : 140;
      const preferredX = mapRect.left + pixel[0] + 18;
      const preferredY = mapRect.top + pixel[1] + 18;

      setHoverInfo({
        x: Math.min(preferredX, window.innerWidth - tooltipWidth),
        y: Math.min(preferredY, window.innerHeight - tooltipHeight),
        title,
        rows,
      });
    },
    [],
  );

  const createStandardLayers = useCallback((): StandardLayers => {
    const backgroundLayer = createCdtmBackgroundLayer();
    const casesSource = createCasesVectorSource();
    const routesSource = createEditorRoutesVectorSource();
    const pointsSource = createEditorPointsVectorSource();
    const casesLayer = createCasesVectorLayer(
      casesSource,
      {
        getDisplayMode: () => displayModeRef.current,
        getCasePropertiesById: () => casePropertiesByIdRef.current,
        getPublicMapStyles: () => publicMapStylesRef.current,
        getSelectionState: (idCase) =>
          idCase === activeCaseIdRef.current
            ? "active"
            : idCase !== null && selectedCaseIdsRef.current.has(idCase)
              ? "selected"
              : "default",
      },
      {
        visible: casesVisibleRef.current,
      },
    );
    const routesLayer = createEditorRoutesVectorLayer(routesSource, {
      visible: routesVisibleRef.current,
    });
    const pointsLayer = createEditorPointsVectorLayer(pointsSource, {
      visible: localitiesVisibleRef.current || landmarksVisibleRef.current,
      context: {
        getIconImagePath: (iconKey) =>
          iconKey ? (mapIconSourceByKeyRef.current[iconKey] ?? null) : null,
        getLocalityDefaultIconKeyForType: (typeKey) =>
          localityDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getLandmarkDefaultIconKeyForType: (typeKey) =>
          landmarkDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getLandmarkTypeCategory: (typeKey) =>
          landmarkCategoryByTypeRef.current[typeKey] ?? null,
        getDisplayMode: () => objectDisplayModeRef.current,
        isFamilyVisible: (family) =>
          family === "locality"
            ? localitiesVisibleRef.current
            : landmarksVisibleRef.current,
      },
    });

    return {
      backgroundLayer,
      casesSource,
      casesLayer,
      routesSource,
      routesLayer,
      pointsSource,
      pointsLayer,
    };
  }, []);

  const createMap = useCallback(
    (target: HTMLElement, layers: VectorLayer[] | BaseLayer[]): Map => {
      void preloadCdtmBackgroundImage();
      return createCdtmMap(target, layers);
    },
    [],
  );

  const bindStandardHandles = useCallback((handles: RuntimeHandles) => {
    mapRef.current = handles.map;
    casesSourceRef.current = handles.casesSource;
    casesLayerRef.current = handles.casesLayer;
    routesSourceRef.current = handles.routesSource;
    routesLayerRef.current = handles.routesLayer;
    pointsSourceRef.current = handles.pointsSource;
    pointsLayerRef.current = handles.pointsLayer;
  }, []);

  const resetStandardHandles = useCallback(() => {
    mapRef.current = null;
    casesSourceRef.current = null;
    casesLayerRef.current = null;
    routesSourceRef.current = null;
    routesLayerRef.current = null;
    pointsSourceRef.current = null;
    pointsLayerRef.current = null;
  }, []);

  const fitCasesExtent = useCallback((duration = 200) => {
    if (!mapRef.current) {
      return;
    }

    fitCdtmCasesExtent(mapRef.current, duration);
  }, []);

  const focusCaseById = useCallback((idCase: string, duration = 250) => {
    const source = casesSourceRef.current;
    const map = mapRef.current;

    if (!source || !map) {
      return;
    }

    const geometry = source.getFeatureById(idCase)?.getGeometry();

    if (!geometry) {
      return;
    }

    map.getView().fit(geometry.getExtent(), {
      duration,
      padding: [70, 70, 70, 70],
      maxZoom: MAP_MAX_ZOOM,
    });
  }, []);

  const focusCasesByIds = useCallback((idCases: string[], duration = 250) => {
    const source = casesSourceRef.current;
    const map = mapRef.current;

    if (!source || !map || idCases.length === 0) {
      return;
    }

    let combinedExtent: [number, number, number, number] | null = null;

    for (const idCase of idCases) {
      const extent = source.getFeatureById(idCase)?.getGeometry()?.getExtent();

      if (!extent) {
        continue;
      }

      combinedExtent = combinedExtent
        ? [
            Math.min(combinedExtent[0], extent[0]),
            Math.min(combinedExtent[1], extent[1]),
            Math.max(combinedExtent[2], extent[2]),
            Math.max(combinedExtent[3], extent[3]),
          ]
        : [extent[0], extent[1], extent[2], extent[3]];
    }

    if (!combinedExtent) {
      return;
    }

    map.getView().fit(combinedExtent, {
      duration,
      padding: [70, 70, 70, 70],
      maxZoom: MAP_MAX_ZOOM,
    });
  }, []);

  const focusPoint = useCallback((x: number, y: number, duration = 250) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.getView().fit([x - 20, y - 20, x + 20, y + 20], {
      duration,
      padding: [80, 80, 80, 80],
      maxZoom: MAP_MAX_ZOOM,
    });
  }, []);

  const focusRoute = useCallback(
    (points: Array<[number, number]>, duration = 250) => {
      const map = mapRef.current;

      if (!map || points.length === 0) {
        return;
      }

      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);

      map
        .getView()
        .fit(
          [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
          {
            duration,
            padding: [80, 80, 80, 80],
            maxZoom: MAP_MAX_ZOOM,
          },
        );
    },
    [],
  );

  useEffect(() => {
    casePropertiesByIdRef.current = casePropertiesById;
    casesLayerRef.current?.changed();
  }, [casePropertiesById]);

  useEffect(() => {
    publicMapStylesRef.current = publicMapStyles;
    casesLayerRef.current?.changed();
  }, [publicMapStyles]);

  useEffect(() => {
    displayModeRef.current = normalizeMapDisplayMode(displayMode);
    casesLayerRef.current?.changed();
    const frame = requestAnimationFrame(() => {
      clearHover();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [clearHover, displayMode]);

  useEffect(() => {
    objectDisplayModeRef.current = objectDisplayMode;
    pointsLayerRef.current?.changed();
  }, [objectDisplayMode]);

  useEffect(() => {
    const previousActiveCaseId = activeCaseIdRef.current;
    const previousSelectedIds = selectedCaseIdsRef.current;
    const nextSelectedIds = new Set(selectedCaseIds);

    activeCaseIdRef.current = activeCaseId;
    selectedCaseIdsRef.current = nextSelectedIds;

    if (
      previousActiveCaseId === activeCaseId &&
      areStringSetsEqual(previousSelectedIds, nextSelectedIds)
    ) {
      return;
    }

    const source = casesSourceRef.current;

    if (!source) {
      return;
    }

    const changedIds = new Set<string>();

    if (previousActiveCaseId) {
      changedIds.add(previousActiveCaseId);
    }

    if (activeCaseId) {
      changedIds.add(activeCaseId);
    }

    for (const idCase of previousSelectedIds) {
      changedIds.add(idCase);
    }

    for (const idCase of nextSelectedIds) {
      changedIds.add(idCase);
    }

    for (const idCase of changedIds) {
      source.getFeatureById(idCase)?.changed();
    }
  }, [activeCaseId, selectedCaseIds]);

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(casesLayerRef.current, casesVisible);

    if (!casesVisible) {
      const frame = requestAnimationFrame(() => {
        clearHover();
      });
      onCasesHidden?.();

      return () => {
        cancelAnimationFrame(frame);
      };
    }
  }, [casesVisible, clearHover, onCasesHidden]);

  useEffect(() => {
    localitiesVisibleRef.current = localitiesVisible;
    landmarksVisibleRef.current = landmarksVisible;
    routesVisibleRef.current = routesVisible;

    syncEditorPointsLayerVisibility(
      pointsLayerRef.current,
      localitiesVisible || landmarksVisible,
    );
    syncEditorRoutesLayerVisibility(routesLayerRef.current, routesVisible);
    pointsLayerRef.current?.changed();
    routesLayerRef.current?.changed();
    const frame = requestAnimationFrame(() => {
      clearHover();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [clearHover, landmarksVisible, localitiesVisible, routesVisible]);

  useEffect(() => {
    if (typeof clearHoverRequest !== "number") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      clearHover();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [clearHover, clearHoverRequest]);

  return {
    mapElementRef,
    mapRef,
    casesSourceRef,
    casesLayerRef,
    pointsSourceRef,
    pointsLayerRef,
    routesSourceRef,
    routesLayerRef,
    casesVisibleRef,
    localitiesVisibleRef,
    landmarksVisibleRef,
    routesVisibleRef,
    activeCaseIdRef,
    selectedCaseIdsRef,
    casePropertiesByIdRef,
    publicMapStylesRef,
    displayModeRef,
    objectDisplayModeRef,
    mapIconSourceByKeyRef,
    localityDefaultIconKeyByTypeRef,
    landmarkDefaultIconKeyByTypeRef,
    landmarkCategoryByTypeRef,
    hoverInfo,
    setHoverInfo,
    clearHover,
    getTooltipPosition,
    showTooltipAtCoordinate,
    createStandardLayers,
    createMap,
    bindStandardHandles,
    resetStandardHandles,
    fitCasesExtent,
    focusCaseById,
    focusCasesByIds,
    focusPoint,
    focusRoute,
  };
}

export type CdtmMapRuntime = ReturnType<typeof useCdtmMapRuntime>;

export function cleanupEvents(keys: EventsKey[]) {
  for (const key of keys) {
    unByKey(key);
  }
}
