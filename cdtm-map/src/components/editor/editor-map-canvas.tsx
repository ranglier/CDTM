"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Feature from "ol/Feature";
import Point from "ol/geom/Point";
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
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";

import type { PublicMapStyles, StableCaseFeatureCollection, StableCaseProperties } from "@/map/types";
import type { EditorMapLocality } from "@/editor/types";
import {
  CASES_EXTENT,
  MAP_FIT_PADDING,
  MAP_BACKGROUND_PATH,
  MAP_EXTENT,
  MAP_MAX_ZOOM,
  MAP_PROJECTION_CODE,
} from "@/map/config";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  replaceCaseFeatures,
  syncCaseLayerVisibility,
} from "@/map/openlayers/cases-layer";

type HoverInfo = {
  x: number;
  y: number;
  title: string;
  rows: Array<{ label: string; value: string }>;
};

type EditorMapCanvasProps = {
  localities: EditorMapLocality[];
  stableCaseCollection: StableCaseFeatureCollection | null;
  casePropertiesById: Record<string, StableCaseProperties>;
  publicMapStyles: PublicMapStyles;
  showInfluenceOverlay: boolean;
  toolbar?: ReactNode;
  selectedLocalityId: string | null;
  focusLocalityId: string | null;
  focusRequest: number;
  onSelectLocality: (id: string | null) => void;
};

const editorProjection = new Projection({
  code: MAP_PROJECTION_CODE,
  extent: MAP_EXTENT,
  units: "pixels",
});

addProjection(editorProjection);

const EDITOR_INFLUENCE_LAYER_OPACITY = 0.55;

function getLocalityStyle(locality: EditorMapLocality | null, selected: boolean): Style {
  const palette =
    locality?.status === "archived"
      ? {
          fill: "rgba(148, 163, 184, 0.20)",
          stroke: "rgba(148, 163, 184, 0.72)",
        }
      : locality?.status === "draft"
        ? {
            fill: "rgba(229, 192, 98, 0.24)",
            stroke: "rgba(229, 192, 98, 0.92)",
          }
        : {
            fill: "rgba(101, 178, 255, 0.26)",
            stroke: "rgba(101, 178, 255, 0.96)",
          };

  return new Style({
    image: new CircleStyle({
      radius: selected ? 8 : 6,
      fill: new Fill({ color: palette.fill }),
      stroke: new Stroke({
        color: selected ? "rgba(255, 244, 214, 0.98)" : palette.stroke,
        width: selected ? 3 : 2,
      }),
    }),
  });
}

function buildHoverRows(locality: EditorMapLocality | null) {
  if (!locality) {
    return [];
  }

  return [
    { label: "Type", value: locality.type_key },
    { label: "Statut", value: locality.status },
    locality.id_case_detected ? { label: "Case", value: locality.id_case_detected } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);
}

export function EditorMapCanvas({
  localities,
  stableCaseCollection,
  casePropertiesById,
  publicMapStyles,
  showInfluenceOverlay,
  toolbar,
  selectedLocalityId,
  focusLocalityId,
  focusRequest,
  onSelectLocality,
}: EditorMapCanvasProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const localitiesSourceRef = useRef<VectorSource | null>(null);
  const casesSourceRef = useRef<ReturnType<typeof createCasesVectorSource> | null>(null);
  const casesLayerRef = useRef<ReturnType<typeof createCasesVectorLayer> | null>(null);
  const selectedLocalityIdRef = useRef<string | null>(selectedLocalityId);
  const previousSelectedLocalityIdRef = useRef<string | null>(selectedLocalityId);
  const casePropertiesByIdRef = useRef<Record<string, StableCaseProperties>>(casePropertiesById);
  const publicMapStylesRef = useRef<PublicMapStyles>(publicMapStyles);
  const casesVisibleRef = useRef(showInfluenceOverlay && stableCaseCollection !== null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const view = useMemo(
    () =>
      new View({
        projection: editorProjection,
        center: [1600, -2000],
        extent: MAP_EXTENT,
        maxZoom: MAP_MAX_ZOOM,
        showFullExtent: true,
      }),
    [],
  );

  const focusLocality = useCallback((localityId: string, duration = 250) => {
    const source = localitiesSourceRef.current;
    const map = mapRef.current;

    if (!source || !map) {
      return;
    }

    const feature = source.getFeatureById(localityId);
    const geometry = feature?.getGeometry();

    if (!(geometry instanceof Point)) {
      return;
    }

    map.getView().animate({
      center: geometry.getCoordinates(),
      duration,
      zoom: Math.min(Math.max(map.getView().getZoom() ?? 4, 4), MAP_MAX_ZOOM),
    });
  }, []);

  useEffect(() => {
    const previousSelectedLocalityId = previousSelectedLocalityIdRef.current;
    selectedLocalityIdRef.current = selectedLocalityId;
    previousSelectedLocalityIdRef.current = selectedLocalityId;

    const source = localitiesSourceRef.current;

    if (!source) {
      return;
    }

    if (previousSelectedLocalityId && previousSelectedLocalityId !== selectedLocalityId) {
      source.getFeatureById(previousSelectedLocalityId)?.changed();
    }

    if (selectedLocalityId) {
      source.getFeatureById(selectedLocalityId)?.changed();
    }
  }, [selectedLocalityId]);

  useEffect(() => {
    casePropertiesByIdRef.current = casePropertiesById;
    casesLayerRef.current?.changed();
  }, [casePropertiesById]);

  useEffect(() => {
    publicMapStylesRef.current = publicMapStyles;
    casesLayerRef.current?.changed();
  }, [publicMapStyles]);

  useEffect(() => {
    const visible = showInfluenceOverlay && stableCaseCollection !== null;
    casesVisibleRef.current = visible;
    syncCaseLayerVisibility(casesLayerRef.current, visible);
  }, [showInfluenceOverlay, stableCaseCollection]);

  useEffect(() => {
    if (!focusLocalityId) {
      return;
    }

    focusLocality(focusLocalityId);
  }, [focusLocality, focusLocalityId, focusRequest]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const backgroundLayer = new ImageLayer({
      source: new ImageStatic({
        url: MAP_BACKGROUND_PATH,
        imageExtent: MAP_EXTENT,
        projection: editorProjection,
      }),
    });

    const casesSource = createCasesVectorSource();
    const casesLayer = createCasesVectorLayer(
      casesSource,
      {
        getDisplayMode: () => "influence",
        getCasePropertiesById: () => casePropertiesByIdRef.current,
        getPublicMapStyles: () => publicMapStylesRef.current,
        getSelectionState: () => "default",
      },
      {
        visible: casesVisibleRef.current,
        opacity: EDITOR_INFLUENCE_LAYER_OPACITY,
        fallbackWhenUnstyled: true,
      },
    );

    const localitiesSource = new VectorSource();
    const localitiesLayer = new VectorLayer({
      source: localitiesSource,
      style: (feature) => {
        const locality = feature.get("locality") as EditorMapLocality | undefined;
        const localityId = feature.getId();
        const selected =
          typeof localityId === "string" && localityId === selectedLocalityIdRef.current;

        return getLocalityStyle(locality ?? null, selected);
      },
    });

    const map = new Map({
      target: mapElementRef.current,
      layers: [backgroundLayer, casesLayer, localitiesLayer],
      controls: defaultControls({
        attribution: false,
        rotate: false,
      }),
      view,
    });

    map.getView().fit(CASES_EXTENT, {
      duration: 0,
      padding: MAP_FIT_PADDING,
      maxZoom: MAP_MAX_ZOOM,
    });

    const singleClickKey = map.on("singleclick", (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;
      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (candidate) => (candidate instanceof Feature ? candidate : null),
        {
          layerFilter: (candidateLayer) => candidateLayer === localitiesLayer,
        },
      ) as Feature<Point> | null;

      if (!feature) {
        onSelectLocality(null);
        return;
      }

      const localityId = feature.getId();
      onSelectLocality(typeof localityId === "string" ? localityId : null);
    });

    const pointerMoveKey = map.on("pointermove", (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;
      const target = map.getTargetElement();
      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (candidate) => (candidate instanceof Feature ? candidate : null),
        {
          layerFilter: (candidateLayer) => candidateLayer === localitiesLayer,
        },
      ) as Feature<Point> | null;

      if (!feature) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      const locality = feature.get("locality") as EditorMapLocality | undefined;
      const rows = buildHoverRows(locality ?? null);

      if (!locality || rows.length === 0) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      target.style.cursor = "pointer";
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
      const preferredX = event.originalEvent.clientX + 18;
      const preferredY = event.originalEvent.clientY + 18;

      setHoverInfo({
        x: viewportWidth > 0 ? Math.min(preferredX, viewportWidth - 260) : preferredX,
        y: viewportHeight > 0 ? Math.min(preferredY, viewportHeight - 120) : preferredY,
        title: locality.name,
        rows,
      });
    });

    casesSourceRef.current = casesSource;
    localitiesSourceRef.current = localitiesSource;
    casesLayerRef.current = casesLayer;
    syncCaseLayerVisibility(casesLayer, casesVisibleRef.current);
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
      casesSourceRef.current = null;
      localitiesSourceRef.current = null;
      casesLayerRef.current = null;
      mapRef.current = null;
    };
  }, [onSelectLocality, view]);

  useEffect(() => {
    const source = localitiesSourceRef.current;

    if (!source) {
      return;
    }

    const features = localities.map((locality) => {
      const feature = new Feature({
        geometry: new Point([locality.x, locality.y]),
        kind: "locality",
        locality,
      });

      feature.setId(locality.id_locality);
      return feature;
    });

    source.clear(true);
    source.addFeatures(features);
  }, [localities]);

  useEffect(() => {
    const source = casesSourceRef.current;

    if (!source) {
      return;
    }

    replaceCaseFeatures(source, stableCaseCollection, editorProjection);
    syncCaseLayerVisibility(casesLayerRef.current, casesVisibleRef.current);
  }, [stableCaseCollection]);

  return (
    <section className="relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[28px] bg-background/70 xl:min-h-0 xl:h-full">
      <div
        ref={mapElementRef}
        className="h-[calc(100svh-2rem)] w-full xl:h-full"
        aria-label="Carte editeur des localites"
      />
      {toolbar ? <div className="absolute right-6 top-6 z-20 max-w-[min(100%-5rem,48rem)]">{toolbar}</div> : null}
      {hoverInfo ? (
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
