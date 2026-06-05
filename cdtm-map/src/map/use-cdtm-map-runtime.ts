"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import type BaseLayer from "ol/layer/Base";
import type VectorLayer from "ol/layer/Vector";
import type Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";

import { MAP_CASE_TILE_BACKUP_IDLE_OPACITY, MAP_MAX_ZOOM } from "@/map/config";
import { measureMapPerformanceSync } from "@/map/map-performance";
import {
  getPublicPointerMoveThrottleMs,
  resolvePublicObjectDisplayMode,
} from "@/map/public-lod";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  syncCaseLayerVisibility,
} from "@/map/openlayers/cases-layer";
import {
  attachCasePatternsRenderer,
  type CasePatternsRendererHandle,
} from "@/map/openlayers/case-patterns-renderer";
import type { PublicMapBackgroundManifest } from "@/map/background";
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
  createCdtmCaseRasterBackupLayer,
  createCdtmCaseRasterLayer,
  createCdtmCompositeRasterLayer,
  createCdtmBackgroundLayer,
  createCdtmMap,
  fitCdtmCasesExtent,
  loadCdtmMapBackgroundManifest,
  preloadCdtmBackgroundImage,
  refreshCdtmCaseRasterLayer,
  refreshCdtmCompositeRasterLayer,
  shouldUseStaticMapBackground,
} from "@/map/openlayers/map-core";
import type { PublicMapCaseTileManifest } from "@/map/case-tiles";
import type { PublicMapCompositeTileManifest } from "@/map/composite-tiles";
import {
  createEmptyPublicMapStyles,
  normalizeMapDisplayMode,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";
import type { MapObjectPointShape } from "@/map/point-shapes";

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

export type CdtmMapObjectDefaultAppearance = {
  marker_shape: MapObjectPointShape | null;
  marker_fill_color: string | null;
  marker_stroke_color: string | null;
};

type StandardLayers = {
  backgroundLayer: ReturnType<typeof createCdtmBackgroundLayer>;
  compositeRasterLayer: ReturnType<typeof createCdtmCompositeRasterLayer>;
  caseRasterBackupLayer: ReturnType<typeof createCdtmCaseRasterBackupLayer>;
  caseRasterLayer: ReturnType<typeof createCdtmCaseRasterLayer>;
  casesSource: ReturnType<typeof createCasesVectorSource>;
  caseFillLayer: ReturnType<typeof createCasesVectorLayer>;
  casesLayer: ReturnType<typeof createCasesVectorLayer>;
  routesSource: ReturnType<typeof createEditorRoutesVectorSource>;
  routesLayer: ReturnType<typeof createEditorRoutesVectorLayer>;
  pointsSource: ReturnType<typeof createEditorPointsVectorSource>;
  pointsLayer: ReturnType<typeof createEditorPointsVectorLayer>;
};

type RuntimeHandles = Omit<
  StandardLayers,
  "backgroundLayer" | "compositeRasterLayer"
> & {
  map: Map;
  compositeRasterLayer?: StandardLayers["compositeRasterLayer"];
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
  publicLodEnabled?: boolean;
  mobileLayout?: boolean;
  caseTileManifest?: PublicMapCaseTileManifest | null;
  compositeTileManifest?: PublicMapCompositeTileManifest | null;
  caseRenderingMode?: "vector" | "raster-interaction" | "raster-picking";
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
  getHitTestDelayMs,
}: {
  map: Map;
  runHitTests: (event: MapBrowserEvent<PointerEvent>) => void;
  clearHover: () => void;
  getHitTestDelayMs?: () => number;
}): () => void {
  let mapInteracting = false;
  let pointerMoveFrame: number | null = null;
  let latestPointerMoveEvent: MapBrowserEvent<PointerEvent> | null = null;
  let lastHitTestAt = 0;

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

      const delayMs = Math.max(0, getHitTestDelayMs?.() ?? 0);
      const now =
        typeof performance === "undefined" ? Date.now() : performance.now();

      if (delayMs > 0 && now - lastHitTestAt < delayMs) {
        return;
      }

      lastHitTestAt = now;
      measureMapPerformanceSync("pointermove.hit-tests", () => {
        runHitTests(event);
      });
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
  publicLodEnabled = false,
  mobileLayout = false,
  caseTileManifest = null,
  compositeTileManifest = null,
  caseRenderingMode = "vector",
  clearHoverRequest,
  onCasesHidden,
}: UseCdtmMapRuntimeOptions) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const casesSourceRef = useRef<ReturnType<
    typeof createCasesVectorSource
  > | null>(null);
  const caseFillLayerRef = useRef<ReturnType<
    typeof createCasesVectorLayer
  > | null>(null);
  const casesLayerRef = useRef<ReturnType<
    typeof createCasesVectorLayer
  > | null>(null);
  const caseRasterLayerRef = useRef<ReturnType<
    typeof createCdtmCaseRasterLayer
  > | null>(null);
  const caseRasterBackupLayerRef = useRef<ReturnType<
    typeof createCdtmCaseRasterBackupLayer
  > | null>(null);
  const compositeRasterLayerRef = useRef<ReturnType<
    typeof createCdtmCompositeRasterLayer
  > | null>(null);
  const casePatternsRendererRef = useRef<CasePatternsRendererHandle | null>(
    null,
  );
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
  const publicLodEnabledRef = useRef(publicLodEnabled);
  const mobileLayoutRef = useRef(mobileLayout);
  const mapIconSourceByKeyRef = useRef<Record<string, string>>({});
  const localityDefaultIconKeyByTypeRef = useRef<Record<string, string | null>>(
    {},
  );
  const landmarkDefaultIconKeyByTypeRef = useRef<Record<string, string | null>>(
    {},
  );
  const localityDefaultAppearanceByTypeRef = useRef<
    Record<string, CdtmMapObjectDefaultAppearance>
  >({});
  const landmarkDefaultAppearanceByTypeRef = useRef<
    Record<string, CdtmMapObjectDefaultAppearance>
  >({});
  const landmarkCategoryByTypeRef = useRef<
    Record<string, "landmark" | "unique" | null>
  >({});
  const mapBackgroundManifestRef =
    useRef<PublicMapBackgroundManifest | null>(null);
  const caseTileManifestRef = useRef<PublicMapCaseTileManifest | null>(
    caseTileManifest,
  );
  const compositeTileManifestRef =
    useRef<PublicMapCompositeTileManifest | null>(compositeTileManifest);
  const caseRenderingModeRef = useRef<
    "vector" | "raster-interaction" | "raster-picking"
  >(caseRenderingMode);
  const [mapBackgroundReady, setMapBackgroundReady] = useState(false);
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
    const backgroundLayer = createCdtmBackgroundLayer(
      mapBackgroundManifestRef.current ?? undefined,
    );
    const casesSource = createCasesVectorSource();
    const routesSource = createEditorRoutesVectorSource();
    const pointsSource = createEditorPointsVectorSource();
    const caseLayerContext = {
      getDisplayMode: () => displayModeRef.current,
      getCasePropertiesById: () => casePropertiesByIdRef.current,
      getPublicMapStyles: () => publicMapStylesRef.current,
      getSelectionState: (idCase: string | null) =>
        idCase === activeCaseIdRef.current
          ? "active"
          : idCase !== null && selectedCaseIdsRef.current.has(idCase)
            ? "selected"
            : "default",
    };
    const useCompositeBase =
      compositeTileManifestRef.current?.mode === "composite";
    const useRasterCases =
      caseRenderingModeRef.current !== "vector" &&
      (useCompositeBase || caseTileManifestRef.current?.mode === "raster");
    const caseFillLayer = createCasesVectorLayer(
      casesSource,
      caseLayerContext,
      {
        visible: useRasterCases ? false : casesVisibleRef.current,
        stylePart: useRasterCases ? "interaction" : "fill",
      },
    );
    const casesLayer = createCasesVectorLayer(casesSource, caseLayerContext, {
      visible: casesVisibleRef.current,
      stylePart: useRasterCases ? "interaction" : "stroke",
    });
    const compositeRasterLayer = createCdtmCompositeRasterLayer({
      manifest: compositeTileManifestRef.current,
      getDisplayMode: () => displayModeRef.current,
      visible: useCompositeBase && casesVisibleRef.current,
    });
    const caseRasterLayer = useCompositeBase
      ? null
      : createCdtmCaseRasterLayer({
          manifest: caseTileManifestRef.current,
          getDisplayMode: () => displayModeRef.current,
          visible: useRasterCases && casesVisibleRef.current,
        });
    const caseRasterBackupLayer = useCompositeBase
      ? null
      : createCdtmCaseRasterBackupLayer({
          manifest: caseTileManifestRef.current,
          getDisplayMode: () => displayModeRef.current,
          visible: useRasterCases && casesVisibleRef.current,
        });
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
        getLocalityDefaultAppearanceForType: (typeKey) =>
          localityDefaultAppearanceByTypeRef.current[typeKey] ?? null,
        getLandmarkDefaultAppearanceForType: (typeKey) =>
          landmarkDefaultAppearanceByTypeRef.current[typeKey] ?? null,
        getLandmarkTypeCategory: (typeKey) =>
          landmarkCategoryByTypeRef.current[typeKey] ?? null,
        getDisplayMode: () =>
          publicLodEnabledRef.current
            ? resolvePublicObjectDisplayMode(
                objectDisplayModeRef.current,
                mapRef.current?.getView().getResolution(),
                mobileLayoutRef.current,
              )
            : objectDisplayModeRef.current,
        isFamilyVisible: (family) =>
          family === "locality"
            ? localitiesVisibleRef.current
            : landmarksVisibleRef.current,
      },
    });

    return {
      backgroundLayer,
      compositeRasterLayer,
      caseRasterBackupLayer,
      caseRasterLayer,
      casesSource,
      caseFillLayer,
      casesLayer,
      routesSource,
      routesLayer,
      pointsSource,
      pointsLayer,
    };
  }, []);

  const createMap = useCallback(
    (target: HTMLElement, layers: VectorLayer[] | BaseLayer[]): Map => {
      if (shouldUseStaticMapBackground()) {
        void preloadCdtmBackgroundImage();
      }

      return createCdtmMap(target, layers);
    },
    [],
  );

  const bindStandardHandles = useCallback((handles: RuntimeHandles) => {
    mapRef.current = handles.map;
    casesSourceRef.current = handles.casesSource;
    caseFillLayerRef.current = handles.caseFillLayer;
    casesLayerRef.current = handles.casesLayer;
    compositeRasterLayerRef.current = handles.compositeRasterLayer ?? null;
    caseRasterBackupLayerRef.current = handles.caseRasterBackupLayer;
    caseRasterLayerRef.current = handles.caseRasterLayer;
    casePatternsRendererRef.current?.dispose();
    casePatternsRendererRef.current =
      caseRenderingModeRef.current !== "vector"
        ? null
        : attachCasePatternsRenderer({
            map: handles.map,
            layer: handles.caseFillLayer,
            source: handles.casesSource,
            context: {
              getDisplayMode: () => displayModeRef.current,
              getCasePropertiesById: () => casePropertiesByIdRef.current,
              getPublicMapStyles: () => publicMapStylesRef.current,
            },
            visible: casesVisibleRef.current,
          });
    routesSourceRef.current = handles.routesSource;
    routesLayerRef.current = handles.routesLayer;
    pointsSourceRef.current = handles.pointsSource;
    pointsLayerRef.current = handles.pointsLayer;
  }, []);

  const resetStandardHandles = useCallback(() => {
    casePatternsRendererRef.current?.dispose();
    casePatternsRendererRef.current = null;
    mapRef.current = null;
    casesSourceRef.current = null;
    caseFillLayerRef.current = null;
    casesLayerRef.current = null;
    compositeRasterLayerRef.current = null;
    caseRasterBackupLayerRef.current = null;
    caseRasterLayerRef.current = null;
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
    let cancelled = false;

    async function loadMapBackground() {
      const manifest = await loadCdtmMapBackgroundManifest();

      if (cancelled) {
        return;
      }

      mapBackgroundManifestRef.current = manifest;
      setMapBackgroundReady(true);
    }

    void loadMapBackground();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    casePropertiesByIdRef.current = casePropertiesById;
    caseFillLayerRef.current?.changed();
    casesLayerRef.current?.changed();
    casePatternsRendererRef.current?.render();
  }, [casePropertiesById]);

  useEffect(() => {
    caseTileManifestRef.current = caseTileManifest;
  }, [caseTileManifest]);

  useEffect(() => {
    compositeTileManifestRef.current = compositeTileManifest;
  }, [compositeTileManifest]);

  useEffect(() => {
    caseRenderingModeRef.current = caseRenderingMode;
  }, [caseRenderingMode]);

  useEffect(() => {
    publicMapStylesRef.current = publicMapStyles;
    caseFillLayerRef.current?.changed();
    casesLayerRef.current?.changed();
    casePatternsRendererRef.current?.render();
  }, [publicMapStyles]);

  useEffect(() => {
    displayModeRef.current = normalizeMapDisplayMode(displayMode);
    caseFillLayerRef.current?.changed();
    casesLayerRef.current?.changed();
    casePatternsRendererRef.current?.render();
    refreshCdtmCaseRasterLayer(caseRasterLayerRef.current);
    refreshCdtmCaseRasterLayer(caseRasterBackupLayerRef.current);
    refreshCdtmCompositeRasterLayer(compositeRasterLayerRef.current);
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
    publicLodEnabledRef.current = publicLodEnabled;
    mobileLayoutRef.current = mobileLayout;
    pointsLayerRef.current?.changed();
  }, [mobileLayout, publicLodEnabled]);

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

    caseFillLayerRef.current?.changed();
    casesLayerRef.current?.changed();
  }, [activeCaseId, selectedCaseIds]);

  useEffect(() => {
    const useRasterCases = caseRenderingModeRef.current !== "vector";

    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(
      caseFillLayerRef.current,
      useRasterCases ? false : casesVisible,
    );
    syncCaseLayerVisibility(casesLayerRef.current, casesVisible);
    caseRasterLayerRef.current?.setVisible(casesVisible);
    caseRasterLayerRef.current?.changed();
    compositeRasterLayerRef.current?.setVisible(useRasterCases && casesVisible);
    compositeRasterLayerRef.current?.changed();
    caseRasterBackupLayerRef.current?.setVisible(useRasterCases && casesVisible);
    caseRasterBackupLayerRef.current?.setOpacity(MAP_CASE_TILE_BACKUP_IDLE_OPACITY);
    caseRasterBackupLayerRef.current?.changed();
    casePatternsRendererRef.current?.setVisible(casesVisible);

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
    caseFillLayerRef,
    casesLayerRef,
    caseRasterBackupLayerRef,
    caseRasterLayerRef,
    compositeRasterLayerRef,
    casePatternsRendererRef,
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
    publicLodEnabledRef,
    mobileLayoutRef,
    mapIconSourceByKeyRef,
    localityDefaultIconKeyByTypeRef,
    landmarkDefaultIconKeyByTypeRef,
    localityDefaultAppearanceByTypeRef,
    landmarkDefaultAppearanceByTypeRef,
    landmarkCategoryByTypeRef,
    mapBackgroundReady,
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

export function getCdtmPublicPointerMoveDelay(
  map: Map,
  mobileLayout: boolean,
): number {
  return getPublicPointerMoveThrottleMs(
    map.getView().getResolution(),
    mobileLayout,
  );
}
