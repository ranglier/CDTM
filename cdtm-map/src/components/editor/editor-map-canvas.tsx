"use client";

import { useEffect, useRef, useState } from "react";

import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import type Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";

import type {
  PublicCaseIndexResponse,
  PublicCaseProperties,
} from "@/admin/types";
import { Button } from "@/components/ui/button";
import { loadJsonData } from "@/data/loaders";
import { buildCasePropertiesById, getStableCasesFromCollection, mergeStableCases } from "@/map/case-data";
import { buildCaseHoverRows } from "@/map/case-hover";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  readCaseFeatures,
  resolveCaseFeatureProperties,
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
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
} from "@/map/types";

type HoverInfo = {
  x: number;
  y: number;
  title: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Requete impossible.";

    try {
      const data = (await response.json()) as { error?: string };

      if (data.error) {
        message = data.error;
      }
    } catch {}

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function buildEditorCasePropertiesById(
  collection: StableCaseFeatureCollection,
  publicCases: PublicCaseProperties[],
): Record<string, StableCaseProperties> {
  const stableCases = getStableCasesFromCollection(collection).map((stableCase) => ({
    ...stableCase,
    registry_id_case: stableCase.registry_id_case ?? stableCase.id_case,
  }));

  return buildCasePropertiesById(mergeStableCases(stableCases, publicCases));
}

export function EditorMapCanvas() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const casesSourceRef = useRef<ReturnType<typeof createCasesVectorSource> | null>(null);
  const casesLayerRef = useRef<ReturnType<typeof createCasesVectorLayer> | null>(null);
  const casesVisibleRef = useRef(true);
  const selectedCaseIdRef = useRef<string | null>(null);
  const casePropertiesByIdRef = useRef<Record<string, StableCaseProperties>>({});
  const publicMapStylesRef = useRef<PublicMapStyles>(createEmptyPublicMapStyles());
  const [casesVisible, setCasesVisible] = useState(true);
  const [casesCount, setCasesCount] = useState<number | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(casesLayerRef.current, casesVisible);

    if (!casesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
  }, [casesVisible]);

  useEffect(() => {
    const previousCaseId = selectedCaseIdRef.current;
    selectedCaseIdRef.current = selectedCaseId;

    const source = casesSourceRef.current;

    if (!source) {
      return;
    }

    if (previousCaseId) {
      source.getFeatureById(previousCaseId)?.changed();
    }

    if (selectedCaseId) {
      source.getFeatureById(selectedCaseId)?.changed();
    }
  }, [selectedCaseId]);

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
        getCasePropertiesById: () => casePropertiesByIdRef.current,
        getPublicMapStyles: () => publicMapStylesRef.current,
        getSelectionState: (idCase) =>
          idCase && idCase === selectedCaseIdRef.current ? "active" : "default",
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

    const singleClickHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;

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
          layerFilter: (candidateLayer) => candidateLayer === casesLayer,
        },
      );

      if (!feature) {
        setSelectedCaseId(null);
        return;
      }

      const id = feature.getId();
      setSelectedCaseId(typeof id === "string" ? id : null);
    };

    const singleClickKey = map.on("singleclick", singleClickHandler);
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
          layerFilter: (candidateLayer) => candidateLayer === casesLayer,
        },
      );

      if (!feature) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      const resolvedCase = resolveCaseFeatureProperties(
        feature as Feature<Geometry>,
        casePropertiesByIdRef.current,
      );
      const rows = buildCaseHoverRows("influence", resolvedCase);

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

    const pointerMoveKey = map.on("pointermove", pointerMoveHandler);

    let cancelled = false;

    async function loadCases() {
      setCasesLoading(true);
      setCasesError(null);

      try {
        const [collection, publicCases] = await Promise.all([
          loadJsonData<StableCaseFeatureCollection>(CASES_DATA_URL),
          fetchJson<PublicCaseIndexResponse>("/api/cases/public-index").catch((error) => {
            console.error("Impossible de charger les styles publics des cases dans l'editeur.", error);

            return {
              cases: [] as PublicCaseProperties[],
              styles: createEmptyPublicMapStyles(),
            };
          }),
        ]);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error("Le GeoJSON des cases ne respecte pas le contrat stable attendu.");
        }

        if (cancelled || !casesSourceRef.current || !mapRef.current) {
          return;
        }

        const features = readCaseFeatures(collection, cdtmProjection);
        casePropertiesByIdRef.current = buildEditorCasePropertiesById(collection, publicCases.cases);
        publicMapStylesRef.current = publicCases.styles;

        casesSourceRef.current.clear(true);
        casesSourceRef.current.addFeatures(features);
        casesLayerRef.current?.changed();
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
      unByKey(singleClickKey);
      unByKey(pointerMoveKey);
      map.getTargetElement().style.cursor = "";
      map.setTarget(undefined);
      casesSourceRef.current = null;
      casesLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  return (
    <section className="relative min-h-[calc(100svh-5rem)] overflow-hidden rounded-[28px] bg-background/70">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto rounded-[20px] border border-border/80 bg-background/90 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
          <Button
            type="button"
            variant={casesVisible ? "secondary" : "outline"}
            onClick={() =>
              setCasesVisible((visible) => {
                if (visible) {
                  setHoverInfo(null);
                }

                return !visible;
              })
            }
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
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedCaseId
              ? `Case selectionnee : ${selectedCaseId}`
              : "Aucune case selectionnee"}
          </p>
          {selectedCaseId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setSelectedCaseId(null)}
            >
              Deselectionner
            </Button>
          ) : null}
          {casesError ? <p className="mt-2 text-xs text-destructive">{casesError}</p> : null}
        </div>
      </div>
      <div
        ref={mapElementRef}
        className="h-[calc(100svh-5rem)] w-full"
        aria-label="Carte editeur"
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
