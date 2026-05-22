"use client";

import { useEffect, useMemo, useRef } from "react";

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
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  isStableCaseFeatureCollection,
  toStableCaseProperties,
} from "@/map/types";

type CasesMapProps = {
  dataUrl: string;
  selectedCaseId: string | null;
  casesVisible: boolean;
  panelVisible: boolean;
  onCaseSelect: (selectedCase: StableCaseProperties | null) => void;
  onCasesVisibilityChange: (visible: boolean) => void;
  onPanelVisibilityChange: (visible: boolean) => void;
  onFeaturesLoad?: (count: number) => void;
};

const casesProjection = new Projection({
  code: MAP_PROJECTION_CODE,
  extent: MAP_EXTENT,
  units: "pixels",
});

addProjection(casesProjection);

const geoJsonFormat = new GeoJSON();

export function CasesMap({
  dataUrl,
  selectedCaseId,
  casesVisible,
  panelVisible,
  onCaseSelect,
  onCasesVisibilityChange,
  onPanelVisibilityChange,
  onFeaturesLoad,
}: CasesMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const layerRef = useRef<VectorLayer | null>(null);
  const casesVisibleRef = useRef(casesVisible);
  const selectedCaseIdRef = useRef<string | null>(selectedCaseId);

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

  useEffect(() => {
    selectedCaseIdRef.current = selectedCaseId;
    layerRef.current?.changed();
  }, [selectedCaseId]);

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    layerRef.current?.setVisible(casesVisible);
    layerRef.current?.changed();

    if (!casesVisible) {
      onCaseSelect(null);
    }
  }, [casesVisible, onCaseSelect]);

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
      style: (feature) => getCaseStyle(feature.get("id_case") === selectedCaseIdRef.current),
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

    map.on("singleclick", (event) => {
      if (!casesVisibleRef.current) {
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
        onCaseSelect(null);
        return;
      }

      onCaseSelect(toStableCaseProperties(feature.getProperties()) ?? null);
    });

    sourceRef.current = source;
    layerRef.current = layer;
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    resizeObserver.observe(mapElementRef.current);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      sourceRef.current = null;
      layerRef.current = null;
      mapRef.current = null;
    };
  }, [onCaseSelect, view]);

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

        sourceRef.current.clear(true);
        sourceRef.current.addFeatures(features);
        onFeaturesLoad?.(features.length);
        fitCasesExtent(0);
      } catch (error) {
        if (cancelled) {
          return;
        }
        onFeaturesLoad?.(0);
        onCaseSelect(null);
        console.error("Impossible de charger la couche publique.", error);
      }
    }

    void loadCases();

    return () => {
      cancelled = true;
    };
  }, [dataUrl, onCaseSelect, onFeaturesLoad]);

  return (
    <section className="relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[28px] bg-background/70 xl:min-h-0 xl:h-full">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto">
          <MapToolbar
            casesVisible={casesVisible}
            panelVisible={panelVisible}
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
    </section>
  );
}
