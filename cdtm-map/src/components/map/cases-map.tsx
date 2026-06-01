"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";

import { MapToolbar } from "@/components/map/map-toolbar";
import { loadJsonData } from "@/data/loaders";
import { buildCaseHoverRows, getCaseHoverTitle } from "@/map/case-hover";
import { MAP_MAX_ZOOM } from "@/map/config";
import {
  buildPublicLandmarkHoverRows,
  buildPublicLocalityHoverRows,
  buildPublicRouteHoverRows,
  createEmptyPublicMapObjectsResponse,
  type PublicMapLandmark,
  type PublicMapLocality,
  type PublicMapObjectsResponse,
  type PublicMapRoute,
  toRenderablePublicLandmarks,
  toRenderablePublicLocalities,
  toRenderablePublicRoutes,
} from "@/map/public-objects";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  readCaseFeatures,
  resolveCaseFeatureProperties,
  syncCaseLayerVisibility,
} from "@/map/openlayers/cases-layer";
import {
  createEditorPointsVectorLayer,
  createEditorPointsVectorSource,
  getEditorLandmarkFromPointFeature,
  getEditorLocalityFromPointFeature,
  getEditorPointFamilyFromFeature,
  replaceEditorPointFeatures,
  syncEditorPointsLayerVisibility,
} from "@/map/openlayers/editor-points-layer";
import {
  createEditorRoutesVectorLayer,
  createEditorRoutesVectorSource,
  getEditorRouteFromFeature,
  replaceEditorRouteFeatures,
  syncEditorRoutesLayerVisibility,
} from "@/map/openlayers/editor-routes-layer";
import {
  cdtmProjection,
  createCdtmBackgroundLayer,
  createCdtmMap,
  fitCdtmCasesExtent,
  preloadCdtmBackgroundImage,
} from "@/map/openlayers/map-core";
import { getNormalizedSvgIconSource } from "@/map/openlayers/svg-icon-source";
import {
  type CaseSelectionIntent,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  isStableCaseFeatureCollection,
  normalizeMapDisplayMode,
} from "@/map/types";
import type { MapSearchTarget } from "@/map/search";

type CasesMapProps = {
  dataUrl: string;
  activeCaseId: string | null;
  selectedCaseIds: string[];
  casePropertiesById: Record<string, StableCaseProperties>;
  publicMapStyles: PublicMapStyles;
  displayMode: MapDisplayMode;
  focusCaseId: string | null;
  focusRequest: number;
  focusCaseIds: string[];
  focusCaseIdsRequest: number;
  focusSearchTarget: MapSearchTarget | null;
  focusSearchRequest: number;
  clearHoverRequest: number;
  casesVisible: boolean;
  panelVisible: boolean;
  onDisplayModeChange: (mode: MapDisplayMode) => void;
  onCaseSelectionChange: (
    selectedCase: StableCaseProperties | null,
    intent: CaseSelectionIntent,
  ) => void;
  onCasesVisibilityChange: (visible: boolean) => void;
  onPanelVisibilityChange: (visible: boolean) => void;
  onFeaturesLoad?: (count: number) => void;
};

type HoverInfo = {
  x: number;
  y: number;
  title: string | null;
  rows: Array<{
    label: string;
    value: string;
  }>;
};

type PublicObjectDisplayMode = "icons" | "points";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status} pour ${url}`);
  }

  return (await response.json()) as T;
}

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

export function CasesMap({
  dataUrl,
  activeCaseId,
  selectedCaseIds,
  casePropertiesById,
  publicMapStyles,
  displayMode,
  focusCaseId,
  focusRequest,
  focusCaseIds,
  focusCaseIdsRequest,
  focusSearchTarget,
  focusSearchRequest,
  clearHoverRequest,
  casesVisible,
  panelVisible,
  onDisplayModeChange,
  onCaseSelectionChange,
  onCasesVisibilityChange,
  onPanelVisibilityChange,
  onFeaturesLoad,
}: CasesMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef<ReturnType<typeof createCasesVectorSource> | null>(
    null,
  );
  const layerRef = useRef<ReturnType<typeof createCasesVectorLayer> | null>(
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
  const localitiesVisibleRef = useRef(true);
  const landmarksVisibleRef = useRef(true);
  const routesVisibleRef = useRef(true);
  const activeCaseIdRef = useRef<string | null>(activeCaseId);
  const selectedCaseIdsRef = useRef<Set<string>>(new Set(selectedCaseIds));
  const casePropertiesByIdRef = useRef(casePropertiesById);
  const publicMapStylesRef = useRef<PublicMapStyles>(publicMapStyles);
  const displayModeRef = useRef<MapDisplayMode>(
    normalizeMapDisplayMode(displayMode),
  );
  const onCaseSelectionChangeRef = useRef(onCaseSelectionChange);
  const onFeaturesLoadRef = useRef(onFeaturesLoad);
  const focusCaseIdRef = useRef(focusCaseId);
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
  const objectDisplayModeRef = useRef<PublicObjectDisplayMode>("points");
  const publicLocalitiesByIdRef = useRef<Record<string, PublicMapLocality>>({});
  const publicLandmarksByIdRef = useRef<Record<string, PublicMapLandmark>>({});
  const publicRoutesByIdRef = useRef<Record<string, PublicMapRoute>>({});
  const [localitiesVisible, setLocalitiesVisible] = useState(true);
  const [landmarksVisible, setLandmarksVisible] = useState(true);
  const [routesVisible, setRoutesVisible] = useState(true);
  const [objectDisplayMode, setObjectDisplayMode] =
    useState<PublicObjectDisplayMode>("points");
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  function fitCasesExtent(duration = 200) {
    if (!mapRef.current) {
      return;
    }

    fitCdtmCasesExtent(mapRef.current, duration);
  }

  const focusCaseById = useCallback((idCase: string, duration = 250) => {
    const source = sourceRef.current;
    const map = mapRef.current;

    if (!source || !map) {
      return;
    }

    const feature = source.getFeatureById(idCase);

    if (!feature) {
      return;
    }

    const geometry = feature.getGeometry();

    if (!geometry) {
      return;
    }

    map.getView().fit(geometry.getExtent(), {
      duration,
      padding: [60, 60, 60, 60],
      maxZoom: MAP_MAX_ZOOM,
    });
  }, []);

  const focusCasesByIds = useCallback((idCases: string[], duration = 250) => {
    const source = sourceRef.current;
    const map = mapRef.current;

    if (!source || !map || idCases.length === 0) {
      return;
    }

    let combinedExtent: [number, number, number, number] | null = null;

    for (const idCase of idCases) {
      const geometry = source.getFeatureById(idCase)?.getGeometry();

      if (!geometry) {
        continue;
      }

      const extent = geometry.getExtent();

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
      const extent: [number, number, number, number] = [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];

      map.getView().fit(extent, {
        duration,
        padding: [80, 80, 80, 80],
        maxZoom: MAP_MAX_ZOOM,
      });
    },
    [],
  );

  const showSearchTargetTooltip = useCallback((target: MapSearchTarget) => {
    if (target.kind === "case") {
      return;
    }

    const map = mapRef.current;

    if (!map) {
      return;
    }

    let coordinate: [number, number] | null = null;
    let title = target.label;
    let rows: Array<{ label: string; value: string }> = [];

    if (target.kind === "locality") {
      const publicLocality = publicLocalitiesByIdRef.current[target.id];
      coordinate = [target.x, target.y];
      title = publicLocality?.name ?? target.label;
      rows = publicLocality
        ? buildPublicLocalityHoverRows(publicLocality)
        : [{ label: "Type", value: "Localite" }];
    } else if (target.kind === "landmark") {
      const publicLandmark = publicLandmarksByIdRef.current[target.id];
      coordinate = [target.x, target.y];
      title = publicLandmark?.name ?? target.label;
      rows = buildPublicLandmarkHoverRows();
    } else {
      const publicRoute = publicRoutesByIdRef.current[target.id];
      const xs = target.points.map(([x]) => x);
      const ys = target.points.map(([, y]) => y);

      if (xs.length > 0 && ys.length > 0) {
        coordinate = [
          (Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2,
        ];
      }
      title = publicRoute?.name ?? target.label;
      rows = publicRoute
        ? buildPublicRouteHoverRows(publicRoute)
        : [{ label: "Type", value: "Route" }];
    }

    if (!coordinate) {
      return;
    }

    const pixel = map.getPixelFromCoordinate(coordinate);
    const mapRect = map.getTargetElement().getBoundingClientRect();
    const tooltipWidth = 260;
    const tooltipHeight = rows.length === 0 ? 72 : rows.length > 2 ? 180 : 140;
    const preferredX = mapRect.left + pixel[0] + 18;
    const preferredY = mapRect.top + pixel[1] + 18;

    setHoverInfo({
      x: Math.min(preferredX, window.innerWidth - tooltipWidth),
      y: Math.min(preferredY, window.innerHeight - tooltipHeight),
      title,
      rows,
    });
  }, []);

  useEffect(() => {
    onCaseSelectionChangeRef.current = onCaseSelectionChange;
  }, [onCaseSelectionChange]);

  useEffect(() => {
    onFeaturesLoadRef.current = onFeaturesLoad;
  }, [onFeaturesLoad]);

  useEffect(() => {
    focusCaseIdRef.current = focusCaseId;
  }, [focusCaseId]);

  useEffect(() => {
    casePropertiesByIdRef.current = casePropertiesById;
    layerRef.current?.changed();
  }, [casePropertiesById]);

  useEffect(() => {
    publicMapStylesRef.current = publicMapStyles;
    layerRef.current?.changed();
  }, [publicMapStyles]);

  useEffect(() => {
    displayModeRef.current = normalizeMapDisplayMode(displayMode);
    layerRef.current?.changed();
    mapRef.current?.getTargetElement().style.setProperty("cursor", "");

    const frame = requestAnimationFrame(() => {
      setHoverInfo(null);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [displayMode]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHoverInfo(null);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [clearHoverRequest]);

  useEffect(() => {
    const previousActiveCaseId = activeCaseIdRef.current;
    activeCaseIdRef.current = activeCaseId;
    const previousSelectedIds = selectedCaseIdsRef.current;
    const nextSelectedIds = new Set(selectedCaseIds);
    selectedCaseIdsRef.current = nextSelectedIds;

    if (
      previousActiveCaseId === activeCaseId &&
      areStringSetsEqual(previousSelectedIds, nextSelectedIds)
    ) {
      return;
    }

    const source = sourceRef.current;

    if (!source) {
      return;
    }

    const changedIds = new Set<string>();

    if (activeCaseId) {
      changedIds.add(activeCaseId);
    }

    if (previousActiveCaseId) {
      changedIds.add(previousActiveCaseId);
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
    if (!focusCaseId) {
      return;
    }

    focusCaseById(focusCaseId);
  }, [focusCaseById, focusCaseId, focusRequest]);

  useEffect(() => {
    if (focusCaseIds.length === 0 || focusCaseIdsRequest === 0) {
      return;
    }

    focusCasesByIds(focusCaseIds);
  }, [focusCaseIds, focusCaseIdsRequest, focusCasesByIds]);

  useEffect(() => {
    if (!focusSearchTarget) {
      return;
    }

    let frame: number | null = null;
    const revealLayer = (callback: () => void) => {
      frame = window.requestAnimationFrame(callback);
    };

    if (focusSearchTarget.kind === "case") {
      focusCaseById(focusSearchTarget.id);
      return;
    }

    if (focusSearchTarget.kind === "locality") {
      revealLayer(() => {
        setLocalitiesVisible(true);
        showSearchTargetTooltip(focusSearchTarget);
      });
      focusPoint(focusSearchTarget.x, focusSearchTarget.y);
    } else if (focusSearchTarget.kind === "landmark") {
      revealLayer(() => {
        setLandmarksVisible(true);
        showSearchTargetTooltip(focusSearchTarget);
      });
      focusPoint(focusSearchTarget.x, focusSearchTarget.y);
    } else {
      revealLayer(() => {
        setRoutesVisible(true);
        showSearchTargetTooltip(focusSearchTarget);
      });
      focusRoute(focusSearchTarget.points);
    }

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [
    focusCaseById,
    focusPoint,
    focusRoute,
    focusSearchRequest,
    focusSearchTarget,
    showSearchTargetTooltip,
  ]);

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(layerRef.current, casesVisible);

    if (!casesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
      onCaseSelectionChangeRef.current(null, "replace");
      const frame = requestAnimationFrame(() => {
        setHoverInfo(null);
      });

      return () => {
        cancelAnimationFrame(frame);
      };
    }
  }, [casesVisible]);

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
    mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    const frame = requestAnimationFrame(() => {
      setHoverInfo(null);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [landmarksVisible, localitiesVisible, routesVisible]);

  useEffect(() => {
    objectDisplayModeRef.current = objectDisplayMode;
    pointsLayerRef.current?.changed();
  }, [objectDisplayMode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      map.updateSize();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [panelVisible]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    void preloadCdtmBackgroundImage();

    const backgroundLayer = createCdtmBackgroundLayer();
    const source = createCasesVectorSource();
    const routesSource = createEditorRoutesVectorSource();
    const pointsSource = createEditorPointsVectorSource();
    const layer = createCasesVectorLayer(
      source,
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

    const map = createCdtmMap(mapElementRef.current, [
      backgroundLayer,
      layer,
      routesLayer,
      pointsLayer,
    ]);

    const singleClickHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;

      if (!casesVisibleRef.current) {
        return;
      }

      const originalEvent = event.originalEvent;
      const isToggleSelection =
        originalEvent instanceof MouseEvent &&
        (originalEvent.shiftKey ||
          originalEvent.ctrlKey ||
          originalEvent.metaKey);

      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (candidate) => {
          if (candidate instanceof Feature) {
            return candidate as Feature<Geometry>;
          }

          return null;
        },
        {
          layerFilter: (candidateLayer) => candidateLayer === layer,
        },
      );

      if (!feature) {
        if (!isToggleSelection) {
          onCaseSelectionChangeRef.current(null, "replace");
        }
        return;
      }

      const resolvedCase = resolveCaseFeatureProperties(
        feature as Feature<Geometry>,
        casePropertiesByIdRef.current,
      );

      onCaseSelectionChangeRef.current(
        resolvedCase,
        isToggleSelection ? "toggle" : "replace",
      );
    };

    const runPointerMoveHitTests = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;
      const target = map.getTargetElement();
      const viewportWidth =
        typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 0;
      const originalEvent = event.originalEvent;
      const preferredX = originalEvent.clientX + 18;
      const preferredY = originalEvent.clientY + 18;

      const setTooltip = (
        title: string | null,
        rows: Array<{ label: string; value: string }>,
      ) => {
        target.style.cursor = "pointer";
        const tooltipWidth = 260;
        const tooltipHeight =
          rows.length === 0 ? 72 : rows.length > 2 ? 180 : 140;

        setHoverInfo({
          x:
            viewportWidth > 0
              ? Math.min(preferredX, viewportWidth - tooltipWidth)
              : preferredX,
          y:
            viewportHeight > 0
              ? Math.min(preferredY, viewportHeight - tooltipHeight)
              : preferredY,
          title,
          rows,
        });
      };

      if (localitiesVisibleRef.current || landmarksVisibleRef.current) {
        const pointFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === pointsLayer,
            hitTolerance: 10,
          },
        );

        if (pointFeature instanceof Feature) {
          const family = getEditorPointFamilyFromFeature(pointFeature);

          if (family === "locality" && localitiesVisibleRef.current) {
            const locality = getEditorLocalityFromPointFeature(pointFeature);
            const publicLocality =
              locality && publicLocalitiesByIdRef.current[locality.id_locality];

            if (publicLocality) {
              setTooltip(
                publicLocality.name,
                buildPublicLocalityHoverRows(publicLocality),
              );
              return;
            }
          }

          if (family === "landmark" && landmarksVisibleRef.current) {
            const landmark = getEditorLandmarkFromPointFeature(pointFeature);
            const publicLandmark =
              landmark && publicLandmarksByIdRef.current[landmark.id_landmark];

            if (publicLandmark) {
              setTooltip(publicLandmark.name, buildPublicLandmarkHoverRows());
              return;
            }
          }
        }
      }

      if (routesVisibleRef.current) {
        const routeFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === routesLayer,
            hitTolerance: 8,
          },
        );

        if (routeFeature instanceof Feature) {
          const route = getEditorRouteFromFeature(routeFeature);
          const publicRoute =
            route && publicRoutesByIdRef.current[route.id_route];

          if (publicRoute) {
            setTooltip(
              publicRoute.name,
              buildPublicRouteHoverRows(publicRoute),
            );
            return;
          }
        }
      }

      if (!casesVisibleRef.current) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      const caseFeature = map.forEachFeatureAtPixel(
        event.pixel,
        (candidate) => {
          if (candidate instanceof Feature) {
            return candidate as Feature<Geometry>;
          }

          return null;
        },
        {
          layerFilter: (candidateLayer) => candidateLayer === layer,
        },
      );

      if (!(caseFeature instanceof Feature)) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      const resolvedCase = resolveCaseFeatureProperties(
        caseFeature,
        casePropertiesByIdRef.current,
      );
      const rows = buildCaseHoverRows(displayModeRef.current, resolvedCase);

      if (rows.length === 0) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      setTooltip(getCaseHoverTitle(displayModeRef.current), rows);
    };

    let mapInteracting = false;
    let pointerMoveFrame: number | null = null;
    let latestPointerMoveEvent: unknown = null;
    const clearPointerHover = () => {
      map.getTargetElement().style.cursor = "";
      setHoverInfo(null);
    };
    const cancelPointerMoveFrame = () => {
      if (pointerMoveFrame !== null) {
        window.cancelAnimationFrame(pointerMoveFrame);
        pointerMoveFrame = null;
      }
      latestPointerMoveEvent = null;
    };
    const pointerMoveHandler = (rawEvent: unknown) => {
      latestPointerMoveEvent = rawEvent;

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
          clearPointerHover();
          return;
        }

        runPointerMoveHitTests(event);
      });
    };
    const moveStartKey = map.on("movestart", () => {
      mapInteracting = true;
      cancelPointerMoveFrame();
      clearPointerHover();
    });
    const moveEndKey = map.on("moveend", () => {
      mapInteracting = false;
    });

    const singleClickKey = map.on("singleclick", singleClickHandler);
    const pointerMoveKey = map.on("pointermove", pointerMoveHandler);

    sourceRef.current = source;
    layerRef.current = layer;
    pointsSourceRef.current = pointsSource;
    pointsLayerRef.current = pointsLayer;
    routesSourceRef.current = routesSource;
    routesLayerRef.current = routesLayer;
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    resizeObserver.observe(mapElementRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelPointerMoveFrame();
      unByKey(singleClickKey);
      unByKey(pointerMoveKey);
      unByKey(moveStartKey);
      unByKey(moveEndKey);
      map.getTargetElement().style.cursor = "";
      map.setTarget(undefined);
      sourceRef.current = null;
      layerRef.current = null;
      pointsSourceRef.current = null;
      pointsLayerRef.current = null;
      routesSourceRef.current = null;
      routesLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCases() {
      if (!sourceRef.current || !mapRef.current) {
        return;
      }

      try {
        const collection =
          await loadJsonData<StableCaseFeatureCollection>(dataUrl);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error(
            "Le GeoJSON des cases ne respecte pas le contrat stable attendu.",
          );
        }

        if (cancelled || !sourceRef.current || !mapRef.current) {
          return;
        }

        const features = readCaseFeatures(collection, cdtmProjection);

        sourceRef.current.clear(true);
        sourceRef.current.addFeatures(features);
        onFeaturesLoadRef.current?.(features.length);
        fitCasesExtent(0);

        if (focusCaseIdRef.current) {
          focusCaseById(focusCaseIdRef.current, 0);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        onFeaturesLoadRef.current?.(0);
        onCaseSelectionChangeRef.current(null, "replace");
        console.error("Impossible de charger la couche publique.", error);
      }
    }

    void loadCases();

    return () => {
      cancelled = true;
    };
  }, [dataUrl, focusCaseById]);

  useEffect(() => {
    let cancelled = false;

    async function loadPublishedObjects() {
      if (!pointsSourceRef.current || !routesSourceRef.current) {
        return;
      }

      try {
        const response =
          await fetchJson<PublicMapObjectsResponse>("/api/map/objects");
        const payload = response ?? createEmptyPublicMapObjectsResponse();

        if (cancelled || !pointsSourceRef.current || !routesSourceRef.current) {
          return;
        }

        publicLocalitiesByIdRef.current = Object.fromEntries(
          payload.localities.map((locality) => [locality.id, locality]),
        );
        publicLandmarksByIdRef.current = Object.fromEntries(
          payload.landmarks.map((landmark) => [landmark.id, landmark]),
        );
        publicRoutesByIdRef.current = Object.fromEntries(
          payload.routes.map((route) => [route.id, route]),
        );
        localityDefaultIconKeyByTypeRef.current = Object.fromEntries(
          payload.reference.locality_types.map((typeRef) => [
            typeRef.value,
            typeRef.default_icon_key,
          ]),
        );
        landmarkDefaultIconKeyByTypeRef.current = Object.fromEntries(
          payload.reference.landmark_types.map((typeRef) => [
            typeRef.value,
            typeRef.default_icon_key,
          ]),
        );
        landmarkCategoryByTypeRef.current = Object.fromEntries(
          payload.reference.landmark_types.map((typeRef) => [
            typeRef.value,
            typeRef.category,
          ]),
        );
        mapIconSourceByKeyRef.current = {};

        replaceEditorPointFeatures(pointsSourceRef.current, {
          localities: toRenderablePublicLocalities(payload.localities),
          landmarks: toRenderablePublicLandmarks(payload.landmarks),
        });
        replaceEditorRouteFeatures(
          routesSourceRef.current,
          toRenderablePublicRoutes(payload.routes),
        );
        pointsLayerRef.current?.changed();
        routesLayerRef.current?.changed();

        void Promise.all(
          payload.reference.map_icons.map(async (iconRef) => {
            if (!iconRef.image_path) {
              return [iconRef.value, null] as const;
            }

            try {
              const normalizedSource = iconRef.image_path
                .toLowerCase()
                .endsWith(".svg")
                ? await getNormalizedSvgIconSource(iconRef.image_path)
                : iconRef.image_path;
              return [iconRef.value, normalizedSource] as const;
            } catch {
              return [iconRef.value, iconRef.image_path] as const;
            }
          }),
        ).then((iconEntries) => {
          if (cancelled || !pointsLayerRef.current) {
            return;
          }

          mapIconSourceByKeyRef.current = Object.fromEntries(
            iconEntries.filter(
              (entry): entry is [string, string] => entry[1] !== null,
            ),
          );
          pointsLayerRef.current.changed();
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Impossible de charger les objets publics.", error);
        publicLocalitiesByIdRef.current = {};
        publicLandmarksByIdRef.current = {};
        publicRoutesByIdRef.current = {};
        mapIconSourceByKeyRef.current = {};
        localityDefaultIconKeyByTypeRef.current = {};
        landmarkDefaultIconKeyByTypeRef.current = {};
        landmarkCategoryByTypeRef.current = {};
        pointsSourceRef.current?.clear(true);
        routesSourceRef.current?.clear(true);
      }
    }

    void loadPublishedObjects();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative h-[72svh] min-h-[72svh] overflow-hidden rounded-[28px] bg-background/70 xl:h-[calc(100svh-6rem)] xl:min-h-0">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto">
          <MapToolbar
            casesVisible={casesVisible}
            localitiesVisible={localitiesVisible}
            landmarksVisible={landmarksVisible}
            routesVisible={routesVisible}
            objectDisplayMode={objectDisplayMode}
            panelVisible={panelVisible}
            displayMode={displayMode}
            onDisplayModeChange={onDisplayModeChange}
            onToggleCases={() => onCasesVisibilityChange(!casesVisible)}
            onToggleLocalities={() =>
              setLocalitiesVisible((visible) => !visible)
            }
            onToggleLandmarks={() => setLandmarksVisible((visible) => !visible)}
            onToggleRoutes={() => setRoutesVisible((visible) => !visible)}
            onToggleObjectDisplayMode={() =>
              setObjectDisplayMode((mode) =>
                mode === "icons" ? "points" : "icons",
              )
            }
            onToggleAllObjects={() => {
              const nextVisible = !(
                localitiesVisible ||
                landmarksVisible ||
                routesVisible
              );
              setLocalitiesVisible(nextVisible);
              setLandmarksVisible(nextVisible);
              setRoutesVisible(nextVisible);
            }}
            onTogglePanel={() => onPanelVisibilityChange(!panelVisible)}
          />
        </div>
      </div>
      <div
        ref={mapElementRef}
        className="h-[72svh] w-full xl:h-[calc(100svh-6rem)]"
        aria-label="Carte des cases publiques"
      />
      {hoverInfo &&
      (casesVisible ||
        localitiesVisible ||
        landmarksVisible ||
        routesVisible) ? (
        <div
          className="pointer-events-none fixed z-[80] min-w-44 rounded-[16px] border border-border/80 bg-background/92 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
          style={{
            left: hoverInfo.x,
            top: hoverInfo.y,
            transform: "translate3d(0, 0, 0)",
          }}
        >
          {hoverInfo.title ? (
            <p className="text-sm font-semibold text-foreground">
              {hoverInfo.title}
            </p>
          ) : null}
          {hoverInfo.rows.length > 0 ? (
            <div
              className={hoverInfo.title ? "mt-2 space-y-1.5" : "space-y-1.5"}
            >
              {hoverInfo.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="text-right text-sm text-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
