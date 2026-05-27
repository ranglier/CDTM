"use client";

import { useEffect, useRef, useState } from "react";

import type Map from "ol/Map";

import { Button } from "@/components/ui/button";
import { loadJsonData } from "@/data/loaders";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  readCaseFeatures,
  syncCaseLayerVisibility,
} from "@/map/openlayers/cases-layer";
import {
  cdtmProjection,
  createCdtmBackgroundLayer,
  createCdtmMap,
  fitCdtmCasesExtent,
} from "@/map/openlayers/map-core";
import {
  CASES_DATA_URL,
  createEmptyPublicMapStyles,
  isStableCaseFeatureCollection,
  type StableCaseFeatureCollection,
} from "@/map/types";

export function EditorMapCanvas() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const casesSourceRef = useRef<ReturnType<typeof createCasesVectorSource> | null>(null);
  const casesLayerRef = useRef<ReturnType<typeof createCasesVectorLayer> | null>(null);
  const casesVisibleRef = useRef(true);
  const [casesVisible, setCasesVisible] = useState(true);
  const [casesCount, setCasesCount] = useState<number | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(casesLayerRef.current, casesVisible);
  }, [casesVisible]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const backgroundLayer = createCdtmBackgroundLayer();
    const casesSource = createCasesVectorSource();
    const casesLayer = createCasesVectorLayer(
      casesSource,
      {
        getDisplayMode: () => "influence",
        getCasePropertiesById: () => ({}),
        getPublicMapStyles: () => createEmptyPublicMapStyles(),
        getSelectionState: () => "default",
      },
      {
        visible: casesVisibleRef.current,
        fallbackWhenUnstyled: true,
      },
    );
    const map = createCdtmMap(mapElementRef.current, [backgroundLayer, casesLayer]);

    casesSourceRef.current = casesSource;
    casesLayerRef.current = casesLayer;
    mapRef.current = map;
    fitCdtmCasesExtent(map, 0);

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(mapElementRef.current);

    let cancelled = false;

    async function loadCases() {
      setCasesLoading(true);
      setCasesError(null);

      try {
        const collection = await loadJsonData<StableCaseFeatureCollection>(CASES_DATA_URL);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error("Le GeoJSON des cases ne respecte pas le contrat stable attendu.");
        }

        if (cancelled || !casesSourceRef.current || !mapRef.current) {
          return;
        }

        const features = readCaseFeatures(collection, cdtmProjection);

        casesSourceRef.current.clear(true);
        casesSourceRef.current.addFeatures(features);
        setCasesCount(features.length);
        fitCdtmCasesExtent(mapRef.current, 0);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Impossible de charger les cases dans l'editeur.", error);
        setCasesCount(0);
        setCasesError(
          error instanceof Error ? error.message : "Chargement des cases impossible.",
        );
      } finally {
        if (!cancelled) {
          setCasesLoading(false);
        }
      }
    }

    void loadCases();

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      map.setTarget(undefined);
      casesSourceRef.current = null;
      casesLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  return (
    <section className="relative h-[calc(100svh-8rem)] overflow-hidden rounded-[28px] bg-background/70">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto rounded-[20px] border border-border/80 bg-background/90 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
          <Button
            type="button"
            variant={casesVisible ? "secondary" : "outline"}
            onClick={() => setCasesVisible((visible) => !visible)}
          >
            {casesVisible ? "Masquer les cases" : "Afficher les cases"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {casesLoading
              ? "Chargement des cases..."
              : casesCount !== null
                ? `${casesCount} cases chargees`
                : "Cases non chargees"}
          </p>
          {casesError ? <p className="mt-2 text-xs text-destructive">{casesError}</p> : null}
        </div>
      </div>
      <div ref={mapElementRef} className="h-full w-full" aria-label="Carte editeur" />
    </section>
  );
}
