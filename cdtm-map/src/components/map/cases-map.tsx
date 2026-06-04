"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";

import { MapToolbar } from "@/components/map/map-toolbar";
import { loadJsonData } from "@/data/loaders";
import { cn } from "@/lib/utils";
import { buildCaseHoverRows, getCaseHoverTitle } from "@/map/case-hover";
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
  readCaseFeatures,
  resolveCaseFeatureProperties,
} from "@/map/openlayers/cases-layer";
import {
  getEditorLandmarkFromPointFeature,
  getEditorLocalityFromPointFeature,
  getEditorPointFamilyFromFeature,
  replaceEditorPointFeatures,
} from "@/map/openlayers/editor-points-layer";
import {
  getEditorRouteFromFeature,
  replaceEditorRouteFeatures,
} from "@/map/openlayers/editor-routes-layer";
import { cdtmProjection } from "@/map/openlayers/map-core";
import { getNormalizedSvgIconSource } from "@/map/openlayers/svg-icon-source";
import {
  attachCdtmPointerMoveLifecycle,
  createCdtmResizeObserver,
  getFeatureAtPixel,
  isToggleSelectionEvent,
  useCdtmMapRuntime,
  type CdtmMapObjectDefaultAppearance,
  type CdtmMapObjectDisplayMode,
} from "@/map/use-cdtm-map-runtime";
import {
  type CaseSelectionIntent,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  isStableCaseFeatureCollection,
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
  mobileLayout?: boolean;
  hoverTooltipsEnabled?: boolean;
  onDisplayModeChange: (mode: MapDisplayMode) => void;
  onCaseSelectionChange: (
    selectedCase: StableCaseProperties | null,
    intent: CaseSelectionIntent,
  ) => void;
  onCasesVisibilityChange: (visible: boolean) => void;
  onPanelVisibilityChange: (visible: boolean) => void;
  onFeaturesLoad?: (count: number) => void;
};

function buildDefaultAppearanceByType(
  options:
    | Array<{
        value: string;
        default_marker_shape?: CdtmMapObjectDefaultAppearance["marker_shape"];
        default_marker_fill_color?: string | null;
        default_marker_stroke_color?: string | null;
      }>
    | undefined,
): Record<string, CdtmMapObjectDefaultAppearance> {
  return Object.fromEntries(
    (options ?? [])
      .map((option) => {
        const appearance = {
          marker_shape: option.default_marker_shape ?? null,
          marker_fill_color: option.default_marker_fill_color ?? null,
          marker_stroke_color: option.default_marker_stroke_color ?? null,
        };

        return [
          option.value,
          appearance,
          Boolean(
            appearance.marker_shape ||
              appearance.marker_fill_color ||
              appearance.marker_stroke_color,
          ),
        ] as const;
      })
      .filter((entry) => entry[2])
      .map(([typeKey, appearance]) => [typeKey, appearance]),
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status} pour ${url}`);
  }

  return (await response.json()) as T;
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
  mobileLayout = false,
  hoverTooltipsEnabled = true,
  onDisplayModeChange,
  onCaseSelectionChange,
  onCasesVisibilityChange,
  onPanelVisibilityChange,
  onFeaturesLoad,
}: CasesMapProps) {
  const onCaseSelectionChangeRef = useRef(onCaseSelectionChange);
  const onFeaturesLoadRef = useRef(onFeaturesLoad);
  const focusCaseIdRef = useRef(focusCaseId);
  const hoverTooltipsEnabledRef = useRef(hoverTooltipsEnabled);
  const publicLocalitiesByIdRef = useRef<Record<string, PublicMapLocality>>({});
  const publicLandmarksByIdRef = useRef<Record<string, PublicMapLandmark>>({});
  const publicRoutesByIdRef = useRef<Record<string, PublicMapRoute>>({});
  const [localitiesVisible, setLocalitiesVisible] = useState(true);
  const [landmarksVisible, setLandmarksVisible] = useState(true);
  const [routesVisible, setRoutesVisible] = useState(true);
  const [objectDisplayMode, setObjectDisplayMode] =
    useState<CdtmMapObjectDisplayMode>("points");
  const handleCasesHidden = useCallback(() => {
    onCaseSelectionChangeRef.current(null, "replace");
  }, []);
  const runtime = useCdtmMapRuntime({
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
    onCasesHidden: handleCasesHidden,
  });
  const {
    mapElementRef,
    mapRef,
    casesSourceRef,
    pointsSourceRef,
    pointsLayerRef,
    routesSourceRef,
    routesLayerRef,
    casesVisibleRef,
    localitiesVisibleRef,
    landmarksVisibleRef,
    routesVisibleRef,
    casePropertiesByIdRef,
    displayModeRef,
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
  } = runtime;

  const showSearchTargetTooltip = useCallback(
    (target: MapSearchTarget) => {
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

      showTooltipAtCoordinate(coordinate, title, rows);
    },
    [mapRef, showTooltipAtCoordinate],
  );

  useEffect(() => {
    onCaseSelectionChangeRef.current = onCaseSelectionChange;
  }, [onCaseSelectionChange]);

  useEffect(() => {
    onFeaturesLoadRef.current = onFeaturesLoad;
  }, [onFeaturesLoad]);

  useEffect(() => {
    hoverTooltipsEnabledRef.current = hoverTooltipsEnabled;

    if (!hoverTooltipsEnabled) {
      clearHover();
    }
  }, [clearHover, hoverTooltipsEnabled]);

  useEffect(() => {
    focusCaseIdRef.current = focusCaseId;
  }, [focusCaseId]);

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
  }, [mapRef, panelVisible]);

  useEffect(() => {
    if (!mapBackgroundReady || !mapElementRef.current || mapRef.current) {
      return;
    }

    const standardLayers = createStandardLayers();
    const map = createMap(mapElementRef.current, [
      standardLayers.backgroundLayer,
      standardLayers.caseFillLayer,
      standardLayers.casesLayer,
      standardLayers.routesLayer,
      standardLayers.pointsLayer,
    ]);

    const singleClickHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;

      if (!casesVisibleRef.current) {
        return;
      }

      const isToggleSelection = isToggleSelectionEvent(event.originalEvent);
      const feature = getFeatureAtPixel(map, event, standardLayers.casesLayer);

      if (!feature) {
        if (!isToggleSelection) {
          onCaseSelectionChangeRef.current(null, "replace");
        }
        return;
      }

      const resolvedCase = resolveCaseFeatureProperties(
        feature,
        casePropertiesByIdRef.current,
      );

      onCaseSelectionChangeRef.current(
        resolvedCase,
        isToggleSelection ? "toggle" : "replace",
      );
    };

    const runPointerMoveHitTests = (rawEvent: unknown) => {
      if (!hoverTooltipsEnabledRef.current) {
        map.getTargetElement().style.cursor = "";
        clearHover();
        return;
      }

      const event = rawEvent as MapBrowserEvent<PointerEvent>;
      const target = map.getTargetElement();

      const setTooltip = (
        title: string | null,
        rows: Array<{ label: string; value: string }>,
      ) => {
        target.style.cursor = "pointer";
        const position = getTooltipPosition(event.originalEvent, {
          height: rows.length === 0 ? 72 : rows.length > 2 ? 180 : 140,
        });

        setHoverInfo({
          x: position.x,
          y: position.y,
          title,
          rows,
        });
      };

      if (localitiesVisibleRef.current || landmarksVisibleRef.current) {
        const pointFeature = getFeatureAtPixel(
          map,
          event,
          standardLayers.pointsLayer,
          10,
        );

        if (pointFeature) {
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
        const routeFeature = getFeatureAtPixel(
          map,
          event,
          standardLayers.routesLayer,
          8,
        );

        if (routeFeature) {
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
        clearHover();
        return;
      }

      const caseFeature = getFeatureAtPixel(
        map,
        event,
        standardLayers.casesLayer,
      );

      if (!caseFeature) {
        target.style.cursor = "";
        clearHover();
        return;
      }

      const resolvedCase = resolveCaseFeatureProperties(
        caseFeature,
        casePropertiesByIdRef.current,
      );
      const rows = buildCaseHoverRows(displayModeRef.current, resolvedCase);

      if (rows.length === 0) {
        target.style.cursor = "";
        clearHover();
        return;
      }

      setTooltip(getCaseHoverTitle(displayModeRef.current), rows);
    };

    const singleClickKey = map.on("singleclick", singleClickHandler);
    const pointerMoveCleanup = attachCdtmPointerMoveLifecycle({
      map,
      runHitTests: runPointerMoveHitTests,
      clearHover,
    });
    bindStandardHandles({
      map,
      casesSource: standardLayers.casesSource,
      caseFillLayer: standardLayers.caseFillLayer,
      casesLayer: standardLayers.casesLayer,
      routesSource: standardLayers.routesSource,
      routesLayer: standardLayers.routesLayer,
      pointsSource: standardLayers.pointsSource,
      pointsLayer: standardLayers.pointsLayer,
    });
    const resizeObserver = createCdtmResizeObserver(map, mapElementRef.current);
    fitCasesExtent(0);

    return () => {
      resizeObserver.disconnect();
      pointerMoveCleanup();
      unByKey(singleClickKey);
      map.getTargetElement().style.cursor = "";
      map.setTarget(undefined);
      resetStandardHandles();
    };
  }, [
    bindStandardHandles,
    casePropertiesByIdRef,
    casesVisibleRef,
    clearHover,
    createMap,
    createStandardLayers,
    displayModeRef,
    fitCasesExtent,
    getTooltipPosition,
    localitiesVisibleRef,
    landmarksVisibleRef,
    mapElementRef,
    mapBackgroundReady,
    mapRef,
    resetStandardHandles,
    routesVisibleRef,
    setHoverInfo,
  ]);

  useEffect(() => {
    if (!mapBackgroundReady) {
      return;
    }

    let cancelled = false;

    async function loadCases() {
      if (!casesSourceRef.current || !mapRef.current) {
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

        if (cancelled || !casesSourceRef.current || !mapRef.current) {
          return;
        }

        const features = readCaseFeatures(collection, cdtmProjection);

        casesSourceRef.current.clear(true);
        casesSourceRef.current.addFeatures(features);
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
  }, [
    casesSourceRef,
    dataUrl,
    fitCasesExtent,
    focusCaseById,
    mapBackgroundReady,
    mapRef,
  ]);

  useEffect(() => {
    if (!mapBackgroundReady) {
      return;
    }

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
        localityDefaultAppearanceByTypeRef.current =
          buildDefaultAppearanceByType(payload.reference.locality_types);
        landmarkDefaultAppearanceByTypeRef.current =
          buildDefaultAppearanceByType(payload.reference.landmark_types);
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
        localityDefaultAppearanceByTypeRef.current = {};
        landmarkDefaultAppearanceByTypeRef.current = {};
        landmarkCategoryByTypeRef.current = {};
        pointsSourceRef.current?.clear(true);
        routesSourceRef.current?.clear(true);
      }
    }

    void loadPublishedObjects();

    return () => {
      cancelled = true;
    };
  }, [
    landmarkCategoryByTypeRef,
    landmarkDefaultAppearanceByTypeRef,
    landmarkDefaultIconKeyByTypeRef,
    localityDefaultAppearanceByTypeRef,
    localityDefaultIconKeyByTypeRef,
    mapBackgroundReady,
    mapIconSourceByKeyRef,
    pointsLayerRef,
    pointsSourceRef,
    routesLayerRef,
    routesSourceRef,
  ]);

  return (
    <section
      className={cn(
        "relative overflow-hidden bg-background/70",
        mobileLayout
          ? "h-[calc(100dvh-8.5rem)] min-h-[28rem] rounded-[20px] sm:h-[72svh] sm:min-h-[72svh] sm:rounded-[28px]"
          : "h-[72svh] min-h-[72svh] rounded-[28px] xl:h-[calc(100svh-6rem)] xl:min-h-0",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute z-20 flex justify-end",
          mobileLayout
            ? "inset-x-2 top-2 sm:inset-x-4 sm:top-4"
            : "inset-x-4 top-4",
        )}
      >
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
        className={cn(
          "w-full",
          mobileLayout
            ? "h-[calc(100dvh-8.5rem)] min-h-[28rem] sm:h-[72svh] sm:min-h-[72svh]"
            : "h-[72svh] xl:h-[calc(100svh-6rem)]",
        )}
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
