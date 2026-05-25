"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import Map from "ol/Map";
import { addProjection } from "ol/proj";
import Projection from "ol/proj/Projection";
import ImageStatic from "ol/source/ImageStatic";
import VectorSource from "ol/source/Vector";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control/defaults";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";

import { MapToolbar } from "@/components/map/map-toolbar";
import { loadJsonData } from "@/data/loaders";
import {
  CASES_EXTENT,
  MAP_BACKGROUND_PATH,
  MAP_EXTENT,
  MAP_MAX_ZOOM,
  MAP_PROJECTION_CODE,
} from "@/map/config";
import { getCaseStyle } from "@/map/styles";
import {
  type CaseSelectionIntent,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  createEmptyPublicMapStyles,
  isStableCaseFeatureCollection,
  normalizeMapDisplayMode,
  toStableCaseProperties,
} from "@/map/types";

type CasesMapProps = {
  dataUrl: string;
  activeCaseId: string | null;
  selectedCaseIds: string[];
  casePropertiesById: Record<string, StableCaseProperties>;
  publicMapStyles: PublicMapStyles;
  displayMode: MapDisplayMode;
  focusCaseId: string | null;
  focusRequest: number;
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
  title: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
};

const casesProjection = new Projection({
  code: MAP_PROJECTION_CODE,
  extent: MAP_EXTENT,
  units: "pixels",
});

addProjection(casesProjection);

const geoJsonFormat = new GeoJSON();

function buildHoverRows(displayMode: MapDisplayMode, properties: StableCaseProperties | null) {
  if (!properties) {
    return [];
  }

  if (displayMode === "faction") {
    return properties.faction ? [{ label: "Faction", value: properties.faction }] : [];
  }

  if (displayMode === "influence") {
    return properties.controleur
      ? [{ label: "Controleur", value: properties.controleur }]
      : properties.faction
        ? [{ label: "Faction", value: properties.faction }]
        : [];
  }

  return [
    properties.terrain_cat ? { label: "Categorie", value: properties.terrain_cat } : null,
    properties.terrain_type ? { label: "Terrain", value: properties.terrain_type } : null,
    properties.relief ? { label: "Relief", value: properties.relief } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
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
  const sourceRef = useRef<VectorSource | null>(null);
  const layerRef = useRef<VectorLayer | null>(null);
  const casesVisibleRef = useRef(casesVisible);
  const activeCaseIdRef = useRef<string | null>(activeCaseId);
  const selectedCaseIdsRef = useRef<Set<string>>(new Set(selectedCaseIds));
  const casePropertiesByIdRef = useRef(casePropertiesById);
  const publicMapStylesRef = useRef<PublicMapStyles>(publicMapStyles);
  const displayModeRef = useRef<MapDisplayMode>(normalizeMapDisplayMode(displayMode));
  const onCaseSelectionChangeRef = useRef(onCaseSelectionChange);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const view = useMemo(
    () =>
      new View({
        projection: casesProjection,
        center: [1600, -2000],
        extent: MAP_EXTENT,
        maxZoom: MAP_MAX_ZOOM,
        showFullExtent: true,
      }),
    [],
  );

  function fitCasesExtent(duration = 200) {
    mapRef.current?.getView().fit(CASES_EXTENT, {
      duration,
      padding: [24, 24, 24, 24],
      maxZoom: MAP_MAX_ZOOM,
    });
  }

  const focusCaseById = useCallback(
    (idCase: string, duration = 250) => {
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
    },
    [],
  );

  useEffect(() => {
    onCaseSelectionChangeRef.current = onCaseSelectionChange;
  }, [onCaseSelectionChange]);

  useEffect(() => {
    casePropertiesByIdRef.current = casePropertiesById;
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
    const previousActiveCaseId = activeCaseIdRef.current;
    activeCaseIdRef.current = activeCaseId;
    const previousSelectedIds = selectedCaseIdsRef.current;
    const nextSelectedIds = new Set(selectedCaseIds);
    selectedCaseIdsRef.current = nextSelectedIds;

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
    casesVisibleRef.current = casesVisible;
    layerRef.current?.setVisible(casesVisible);
    layerRef.current?.changed();

    if (!casesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
      onCaseSelectionChangeRef.current(null, "replace");
    }
  }, [casesVisible]);

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

    const backgroundLayer = new ImageLayer({
      source: new ImageStatic({
        url: MAP_BACKGROUND_PATH,
        imageExtent: MAP_EXTENT,
        projection: casesProjection,
      }),
    });

    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      visible: casesVisibleRef.current,
      style: (feature) => {
        const idCase = feature.get("id_case");
        const selectionState =
          idCase === activeCaseIdRef.current
            ? "active"
            : selectedCaseIdsRef.current.has(idCase)
              ? "selected"
              : "default";
        const caseProperties =
          (typeof idCase === "string" ? casePropertiesByIdRef.current[idCase] : null) ??
          toStableCaseProperties(feature.getProperties()) ??
          null;

        return getCaseStyle({
          selectionState,
          displayMode: displayModeRef.current,
          properties: caseProperties,
          styles: publicMapStylesRef.current ?? createEmptyPublicMapStyles(),
        });
      },
    });

    const map = new Map({
      target: mapElementRef.current,
      layers: [backgroundLayer, layer],
      controls: defaultControls({
        attribution: false,
        rotate: false,
      }),
      view,
    });

    const singleClickHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;

      if (!casesVisibleRef.current) {
        return;
      }

      const originalEvent = event.originalEvent;
      const isToggleSelection =
        originalEvent instanceof MouseEvent &&
        (originalEvent.shiftKey || originalEvent.ctrlKey || originalEvent.metaKey);

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

      const featureProperties = toStableCaseProperties(feature.getProperties());
      const registryId =
        typeof feature.getId() === "string"
          ? feature.getId()
          : featureProperties?.registry_id_case ?? featureProperties?.id_case ?? null;
      const resolvedCase =
        (registryId ? casePropertiesByIdRef.current[registryId] : null) ?? featureProperties ?? null;

      onCaseSelectionChangeRef.current(resolvedCase, isToggleSelection ? "toggle" : "replace");
    };

    const pointerMoveHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;
      const target = map.getTargetElement();

      if (!casesVisibleRef.current) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

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
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      const featureProperties = toStableCaseProperties(feature.getProperties());
      const registryId =
        typeof feature.getId() === "string"
          ? feature.getId()
          : featureProperties?.registry_id_case ?? featureProperties?.id_case ?? null;
      const resolvedCase =
        (registryId ? casePropertiesByIdRef.current[registryId] : null) ?? featureProperties ?? null;
      const rows = buildHoverRows(displayModeRef.current, resolvedCase);

      if (rows.length === 0) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      target.style.cursor = "pointer";
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
      const originalEvent = event.originalEvent;
      const preferredX = originalEvent.clientX + 18;
      const preferredY = originalEvent.clientY + 18;
      const tooltipWidth = 240;
      const tooltipHeight = 120;

      setHoverInfo({
        x: viewportWidth > 0 ? Math.min(preferredX, viewportWidth - tooltipWidth) : preferredX,
        y: viewportHeight > 0 ? Math.min(preferredY, viewportHeight - tooltipHeight) : preferredY,
        title: resolvedCase?.id_case ?? "Case",
        rows,
      });
    };

    const singleClickKey = map.on("singleclick", singleClickHandler);
    const pointerMoveKey = map.on("pointermove", pointerMoveHandler);

    sourceRef.current = source;
    layerRef.current = layer;
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    resizeObserver.observe(mapElementRef.current);

    return () => {
      resizeObserver.disconnect();
      unByKey(singleClickKey);
      unByKey(pointerMoveKey);
      map.getTargetElement().style.cursor = "";
      map.setTarget(undefined);
      sourceRef.current = null;
      layerRef.current = null;
      mapRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    let cancelled = false;

    async function loadCases() {
      if (!sourceRef.current || !mapRef.current) {
        return;
      }

      try {
        const collection = await loadJsonData<StableCaseFeatureCollection>(dataUrl);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error("Le GeoJSON des cases ne respecte pas le contrat stable attendu.");
        }

        if (cancelled || !sourceRef.current || !mapRef.current) {
          return;
        }

        const features = geoJsonFormat.readFeatures(collection as object, {
          dataProjection: casesProjection,
          featureProjection: casesProjection,
        });

        for (const feature of features) {
          const idCase = feature.get("id_case");

          if (typeof idCase === "string" && idCase.length > 0) {
            feature.setId(idCase);
          }
        }

        sourceRef.current.clear(true);
        sourceRef.current.addFeatures(features);
        onFeaturesLoad?.(features.length);
        fitCasesExtent(0);

        if (focusCaseId) {
          focusCaseById(focusCaseId, 0);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        onFeaturesLoad?.(0);
        onCaseSelectionChangeRef.current(null, "replace");
        console.error("Impossible de charger la couche publique.", error);
      }
    }

    void loadCases();

    return () => {
      cancelled = true;
    };
  }, [dataUrl, focusCaseById, focusCaseId, onFeaturesLoad]);

  return (
    <section className="relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[28px] bg-background/70 xl:min-h-0 xl:h-full">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto">
      <MapToolbar
        casesVisible={casesVisible}
        panelVisible={panelVisible}
        displayMode={displayMode}
        onDisplayModeChange={onDisplayModeChange}
        onToggleCases={() => onCasesVisibilityChange(!casesVisible)}
        onTogglePanel={() => onPanelVisibilityChange(!panelVisible)}
      />
        </div>
      </div>
      <div
        ref={mapElementRef}
        className="h-[calc(100svh-2rem)] w-full xl:h-full"
        aria-label="Carte des cases publiques"
      />
      {hoverInfo && casesVisible ? (
        <div
          className="pointer-events-none fixed z-[80] min-w-44 rounded-[16px] border border-border/80 bg-background/92 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
          style={{
            left: hoverInfo.x,
            top: hoverInfo.y,
            transform: "translate3d(0, 0, 0)",
          }}
        >
          <p className="text-sm font-semibold text-foreground">{hoverInfo.title}</p>
          <div className="mt-2 space-y-1.5">
            {hoverInfo.rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {row.label}
                </span>
                <span className="text-right text-sm text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
