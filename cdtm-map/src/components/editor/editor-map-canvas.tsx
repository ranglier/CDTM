"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Collection from "ol/Collection";
import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";
import type Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";
import Translate from "ol/interaction/Translate";

import type {
  PublicCaseIndexResponse,
  PublicCaseProperties,
} from "@/admin/types";
import { Button } from "@/components/ui/button";
import { loadJsonData } from "@/data/loaders";
import type {
  EditorMapLandmark,
  EditorMapLandmarkInput,
  EditorMapLocality,
  EditorMapLocalityInput,
  EditorMapLocalityPatch,
  EditorReferenceData,
} from "@/editor/types";
import {
  buildCasePropertiesById,
  getStableCasesFromCollection,
  mergeStableCases,
} from "@/map/case-data";
import { buildCaseHoverRows } from "@/map/case-hover";
import {
  createCasesVectorLayer,
  createCasesVectorSource,
  readCaseFeatures,
  resolveCaseFeatureProperties,
  syncCaseLayerVisibility,
} from "@/map/openlayers/cases-layer";
import {
  createEditorLandmarksVectorLayer,
  createEditorLandmarksVectorSource,
  getEditorLandmarkFromFeature,
  replaceEditorLandmarkFeatures,
  syncEditorLandmarksLayerVisibility,
  upsertEditorLandmarkFeature,
} from "@/map/openlayers/editor-landmarks-layer";
import {
  createEditorLocalitiesVectorLayer,
  createEditorLocalitiesVectorSource,
  getEditorLocalityFeatureCoordinates,
  getEditorLocalityFromFeature,
  replaceEditorLocalityFeatures,
  setEditorLocalityFeatureCoordinates,
  syncEditorLocalitiesLayerVisibility,
  updateEditorLocalityFeature,
  upsertEditorLocalityFeature,
} from "@/map/openlayers/editor-localities-layer";
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
import { getNormalizedSvgIconSource } from "@/map/openlayers/svg-icon-source";

type HoverInfo = {
  x: number;
  y: number;
  title: string;
  rows: Array<{
    label: string;
    value: string;
  }>;
};

type EditorTool = "select" | "create-point";
type LocalityDisplayMode = "icons" | "points";
type EditorCreateObjectFamily = "locality" | "landmark" | "unique";

type MapObjectCreateDraft = {
  family: EditorCreateObjectFamily;
  x: number;
  y: number;
  id_case_detected: string | null;
  name: string;
  type_key: string;
  icon_key: string | null;
  description: string;
};

type LocalityEditDraft = {
  id_locality: string;
  name: string;
  type_key: string;
  status: "draft" | "published" | "archived";
  description: string;
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

function createLocalityEditDraft(locality: EditorMapLocality): LocalityEditDraft {
  return {
    id_locality: locality.id_locality,
    name: locality.name,
    type_key: locality.type_key,
    status: locality.status,
    description: locality.description ?? "",
  };
}

function getLandmarkCategoryLabel(category: string | null | undefined): string {
  return category === "unique" ? "Lieu unique" : "Landmark";
}

function getDefaultPointFamily(referenceData: EditorReferenceData | null): EditorCreateObjectFamily {
  if ((referenceData?.locality_types.length ?? 0) > 0) {
    return "locality";
  }

  if (
    (referenceData?.landmark_types.filter((option) => option.category !== "unique").length ?? 0) > 0
  ) {
    return "landmark";
  }

  return "unique";
}

function getFirstLandmarkTypeKey(
  referenceData: EditorReferenceData | null,
): string {
  return (
    referenceData?.landmark_types.find((option) => option.category !== "unique")?.value ?? ""
  );
}

function createPointDraft(
  referenceData: EditorReferenceData | null,
  coordinates: { x: number; y: number; id_case_detected: string | null },
  family = getDefaultPointFamily(referenceData),
): MapObjectCreateDraft {
  const localityTypeKey = referenceData?.locality_types[0]?.value ?? "";
  const landmarkTypeKey = getFirstLandmarkTypeKey(referenceData);

  if (family === "unique") {
    return {
      family,
      x: coordinates.x,
      y: coordinates.y,
      id_case_detected: coordinates.id_case_detected,
      name: "",
      type_key: "lieu_unique",
      icon_key: referenceData?.map_icons[0]?.value ?? null,
      description: "",
    };
  }

  return {
    family,
    x: coordinates.x,
    y: coordinates.y,
    id_case_detected: coordinates.id_case_detected,
    name: "",
    type_key: family === "locality" ? localityTypeKey : landmarkTypeKey,
    icon_key: null,
    description: "",
  };
}

function changePointDraftFamily(
  referenceData: EditorReferenceData | null,
  draft: MapObjectCreateDraft,
  family: EditorCreateObjectFamily,
): MapObjectCreateDraft {
  const nextDraft = createPointDraft(
    referenceData,
    {
      x: draft.x,
      y: draft.y,
      id_case_detected: draft.id_case_detected,
    },
    family,
  );

  return {
    ...nextDraft,
    name: draft.name,
    description: draft.description,
  };
}

function getLocalityEditSnapshot(draft: LocalityEditDraft): string {
  return JSON.stringify(draft);
}

function getFirstTranslatedFeature(rawEvent: unknown): Feature<Geometry> | null {
  if (!rawEvent || typeof rawEvent !== "object" || !("features" in rawEvent)) {
    return null;
  }

  const featuresValue = (rawEvent as { features?: unknown }).features;

  if (!(featuresValue instanceof Collection)) {
    return null;
  }

  const feature = featuresValue.getArray()[0];

  return feature instanceof Feature ? (feature as Feature<Geometry>) : null;
}

export function EditorMapCanvas() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const casesSourceRef = useRef<ReturnType<typeof createCasesVectorSource> | null>(null);
  const casesLayerRef = useRef<ReturnType<typeof createCasesVectorLayer> | null>(null);
  const localitiesSourceRef = useRef<ReturnType<typeof createEditorLocalitiesVectorSource> | null>(
    null,
  );
  const localitiesLayerRef = useRef<ReturnType<typeof createEditorLocalitiesVectorLayer> | null>(
    null,
  );
  const landmarksSourceRef = useRef<ReturnType<typeof createEditorLandmarksVectorSource> | null>(
    null,
  );
  const landmarksLayerRef = useRef<ReturnType<typeof createEditorLandmarksVectorLayer> | null>(
    null,
  );
  const casesVisibleRef = useRef(true);
  const localitiesVisibleRef = useRef(true);
  const landmarksVisibleRef = useRef(true);
  const localityDisplayModeRef = useRef<LocalityDisplayMode>("icons");
  const selectedCaseIdRef = useRef<string | null>(null);
  const selectedLocalityIdRef = useRef<string | null>(null);
  const editorToolRef = useRef<EditorTool>("select");
  const localityDraftOpenRef = useRef(false);
  const localityDraggingRef = useRef(false);
  const localityMoveSavingRef = useRef(false);
  const localityTranslateInteractionRef = useRef<Translate | null>(null);
  const localityDragOriginRef = useRef<{
    id_locality: string;
    coordinates: [number, number];
    locality: EditorMapLocality;
  } | null>(null);
  const referenceDataRef = useRef<EditorReferenceData | null>(null);
  const mapIconImagePathByKeyRef = useRef<Record<string, string>>({});
  const mapIconSourceByKeyRef = useRef<Record<string, string>>({});
  const localityDefaultIconKeyByTypeRef = useRef<Record<string, string>>({});
  const landmarkDefaultIconKeyByTypeRef = useRef<Record<string, string>>({});
  const landmarkCategoryByTypeRef = useRef<Record<string, "landmark" | "unique">>({});
  const casePropertiesByIdRef = useRef<Record<string, StableCaseProperties>>({});
  const publicMapStylesRef = useRef<PublicMapStyles>(createEmptyPublicMapStyles());
  const [casesVisible, setCasesVisible] = useState(true);
  const [casesCount, setCasesCount] = useState<number | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [localitiesVisible, setLocalitiesVisible] = useState(true);
  const [localitiesCount, setLocalitiesCount] = useState<number | null>(null);
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [localitiesError, setLocalitiesError] = useState<string | null>(null);
  const [landmarksVisible, setLandmarksVisible] = useState(true);
  const [landmarksCount, setLandmarksCount] = useState<number | null>(null);
  const [landmarksLoading, setLandmarksLoading] = useState(false);
  const [landmarksError, setLandmarksError] = useState<string | null>(null);
  const [referenceData, setReferenceData] = useState<EditorReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [localityDisplayMode, setLocalityDisplayMode] =
    useState<LocalityDisplayMode>("icons");
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedLocality, setSelectedLocality] = useState<EditorMapLocality | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [pointDraft, setPointDraft] = useState<MapObjectCreateDraft | null>(null);
  const [localitySaving, setLocalitySaving] = useState(false);
  const [localitySaveError, setLocalitySaveError] = useState<string | null>(null);
  const [localityEditDraft, setLocalityEditDraft] = useState<LocalityEditDraft | null>(null);
  const [localityEditSnapshot, setLocalityEditSnapshot] = useState<string | null>(null);
  const [localityEditSaving, setLocalityEditSaving] = useState(false);
  const [localityEditError, setLocalityEditError] = useState<string | null>(null);
  const [localityDragging, setLocalityDragging] = useState(false);
  const [localityMoveSaving, setLocalityMoveSaving] = useState(false);
  const [localityMoveError, setLocalityMoveError] = useState<string | null>(null);

  const localityEditDirty =
    localityEditDraft && localityEditSnapshot
      ? getLocalityEditSnapshot(localityEditDraft) !== localityEditSnapshot
      : false;

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(casesLayerRef.current, casesVisible);

    if (!casesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
  }, [casesVisible]);

  useEffect(() => {
    localitiesVisibleRef.current = localitiesVisible;
    syncEditorLocalitiesLayerVisibility(localitiesLayerRef.current, localitiesVisible);

    if (!localitiesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
  }, [localitiesVisible]);

  useEffect(() => {
    landmarksVisibleRef.current = landmarksVisible;
    syncEditorLandmarksLayerVisibility(landmarksLayerRef.current, landmarksVisible);

    if (!landmarksVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
  }, [landmarksVisible]);

  useEffect(() => {
    localityDisplayModeRef.current = localityDisplayMode;
    localitiesLayerRef.current?.changed();
  }, [localityDisplayMode]);

  useEffect(() => {
    editorToolRef.current = editorTool;
  }, [editorTool]);

  useEffect(() => {
    localityDraftOpenRef.current = pointDraft !== null;
  }, [pointDraft]);

  useEffect(() => {
    localityDraggingRef.current = localityDragging;
  }, [localityDragging]);

  useEffect(() => {
    localityMoveSavingRef.current = localityMoveSaving;
  }, [localityMoveSaving]);

  useEffect(() => {
    let cancelled = false;

    referenceDataRef.current = referenceData;
    localityDefaultIconKeyByTypeRef.current = Object.fromEntries(
      (referenceData?.locality_types ?? [])
        .filter(
          (type) =>
            typeof type.default_icon_key === "string" &&
            type.default_icon_key.trim().length > 0,
        )
        .map((type) => [type.value, type.default_icon_key!.trim()]),
    );
    landmarkDefaultIconKeyByTypeRef.current = Object.fromEntries(
      (referenceData?.landmark_types ?? [])
        .filter(
          (type) =>
            typeof type.default_icon_key === "string" &&
            type.default_icon_key.trim().length > 0,
        )
        .map((type) => [type.value, type.default_icon_key!.trim()]),
    );
    landmarkCategoryByTypeRef.current = Object.fromEntries(
      (referenceData?.landmark_types ?? [])
        .filter(
          (type): type is typeof type & { category: "landmark" | "unique" } =>
            type.category === "landmark" || type.category === "unique",
        )
        .map((type) => [type.value, type.category]),
    );

    async function loadIconSources() {
      const iconsWithPath = (referenceData?.map_icons ?? [])
        .filter((icon) => typeof icon.image_path === "string" && icon.image_path.trim().length > 0)
        .map((icon) => [icon.value, icon.image_path!.trim()] as const);

      mapIconImagePathByKeyRef.current = Object.fromEntries(iconsWithPath);

      const entries = await Promise.all(
        iconsWithPath.map(async ([iconKey, imagePath]) => {
          try {
            const source = imagePath.toLowerCase().endsWith(".svg")
              ? await getNormalizedSvgIconSource(imagePath)
              : imagePath;

            return [iconKey, source] as const;
          } catch (error) {
            console.error("Icone SVG impossible a normaliser.", { icon: iconKey, imagePath, error });
            return [iconKey, imagePath] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      mapIconSourceByKeyRef.current = Object.fromEntries(
        entries.filter((entry): entry is readonly [string, string] => entry !== null),
      );
      localitiesLayerRef.current?.changed();
      landmarksLayerRef.current?.changed();
    }

    void loadIconSources();

    return () => {
      cancelled = true;
    };
  }, [referenceData]);

  useEffect(() => {
    selectedLocalityIdRef.current = selectedLocality?.id_locality ?? null;
  }, [selectedLocality]);

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
    const interaction = localityTranslateInteractionRef.current;

    if (!interaction) {
      return;
    }

    interaction.setActive(
      localitiesVisible &&
        editorTool === "select" &&
        !pointDraft &&
        !localityMoveSaving &&
        !localityEditDirty,
    );
  }, [editorTool, pointDraft, localityEditDirty, localityMoveSaving, localitiesVisible]);

  function handleCloseLocalitySelection() {
    setSelectedLocality(null);
    setLocalityEditDraft(null);
    setLocalityEditSnapshot(null);
    setLocalityEditError(null);
  }

  function handleCancelLocalityEdit() {
    if (!selectedLocality) {
      return;
    }

    const draft = createLocalityEditDraft(selectedLocality);

    setLocalityEditDraft(draft);
    setLocalityEditSnapshot(getLocalityEditSnapshot(draft));
    setLocalityEditError(null);
  }

  function selectLocality(locality: EditorMapLocality) {
    const draft = createLocalityEditDraft(locality);

    setSelectedLocality(locality);
    setLocalityEditDraft(draft);
    setLocalityEditSnapshot(getLocalityEditSnapshot(draft));
    setLocalityEditError(null);
    setPointDraft(null);
    setEditorTool("select");
  }

  const detectCaseIdAtCoordinate = useCallback(
    (
    map: Map | null,
    coordinate: [number, number],
  ): string | null => {
    if (!map || !casesVisibleRef.current || !casesLayerRef.current) {
      // For this lot, hidden cases mean we skip case detection during drag save.
      return null;
    }

    const pixel = map.getPixelFromCoordinate(coordinate);
    const feature = map.forEachFeatureAtPixel(
      pixel,
      (candidate) => {
        if (candidate instanceof Feature) {
          return candidate as Feature<Geometry>;
        }

        return null;
      },
      {
        layerFilter: (candidateLayer) => candidateLayer === casesLayerRef.current,
      },
    );
    const id = feature?.getId();

    return typeof id === "string" ? id : null;
    },
    [],
  );

  const handleLocalityTranslateEnd = useCallback(async (rawEvent: unknown) => {
    const origin = localityDragOriginRef.current;
    localityDragOriginRef.current = null;
    setLocalityDragging(false);

    const feature = getFirstTranslatedFeature(rawEvent);

    if (!origin || !feature) {
      return;
    }

    const locality = getEditorLocalityFromFeature(feature);
    const coordinates = getEditorLocalityFeatureCoordinates(feature);

    if (!locality || !coordinates) {
      setEditorLocalityFeatureCoordinates(feature, origin.coordinates);
      updateEditorLocalityFeature(feature, origin.locality);
      return;
    }

    const [x, y] = coordinates;

    if (x === origin.coordinates[0] && y === origin.coordinates[1]) {
      return;
    }

    const idCaseDetected = detectCaseIdAtCoordinate(mapRef.current, [x, y]);

    setLocalityMoveSaving(true);
    setLocalityMoveError(null);

    try {
      const updated = await fetchJson<EditorMapLocality>(
        `/api/admin/editor/localities/${encodeURIComponent(locality.id_locality)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            x,
            y,
            id_case_detected: idCaseDetected,
          } satisfies Pick<EditorMapLocalityPatch, "x" | "y" | "id_case_detected">),
        },
      );

      if (localitiesSourceRef.current) {
        upsertEditorLocalityFeature(localitiesSourceRef.current, updated);
      }

      if (selectedLocalityIdRef.current === updated.id_locality) {
        const nextDraft = createLocalityEditDraft(updated);

        setSelectedLocality(updated);
        setLocalityEditDraft(nextDraft);
        setLocalityEditSnapshot(getLocalityEditSnapshot(nextDraft));
      }
    } catch (error) {
      setEditorLocalityFeatureCoordinates(feature, origin.coordinates);
      updateEditorLocalityFeature(feature, origin.locality);
      setLocalityMoveError(
        error instanceof Error ? error.message : "Deplacement de localite impossible.",
      );
    } finally {
      setLocalityMoveSaving(false);
    }
  }, [detectCaseIdAtCoordinate]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const backgroundLayer = createCdtmBackgroundLayer();
    const casesSource = createCasesVectorSource();
    const localitiesSource = createEditorLocalitiesVectorSource();
    const landmarksSource = createEditorLandmarksVectorSource();
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
    const localitiesLayer = createEditorLocalitiesVectorLayer(localitiesSource, {
      context: {
        getIconImagePath: (iconKey) =>
          iconKey ? mapIconSourceByKeyRef.current[iconKey] ?? null : null,
        getDefaultIconKeyForType: (typeKey) =>
          localityDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getDisplayMode: () => localityDisplayModeRef.current,
      },
      visible: localitiesVisibleRef.current,
    });
    const landmarksLayer = createEditorLandmarksVectorLayer(landmarksSource, {
      context: {
        getIconImagePath: (iconKey) =>
          iconKey ? mapIconSourceByKeyRef.current[iconKey] ?? null : null,
        getDefaultIconKeyForType: (typeKey) =>
          landmarkDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getTypeCategory: (typeKey) => landmarkCategoryByTypeRef.current[typeKey] ?? null,
      },
      visible: landmarksVisibleRef.current,
    });
    const map = createCdtmMap(mapElementRef.current, [
      backgroundLayer,
      casesLayer,
      localitiesLayer,
      landmarksLayer,
    ]);
    const translateInteraction = new Translate({
      layers: [localitiesLayer],
    });

    casesSourceRef.current = casesSource;
    casesLayerRef.current = casesLayer;
    localitiesSourceRef.current = localitiesSource;
    localitiesLayerRef.current = localitiesLayer;
    landmarksSourceRef.current = landmarksSource;
    landmarksLayerRef.current = landmarksLayer;
    localityTranslateInteractionRef.current = translateInteraction;
    mapRef.current = map;
    fitCdtmCasesExtent(map, 0);
    map.addInteraction(translateInteraction);

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(mapElementRef.current);

    const translateStartKey = translateInteraction.on("translatestart", (event: unknown) => {
      const feature = getFirstTranslatedFeature(event);

      if (!(feature instanceof Feature)) {
        localityDragOriginRef.current = null;
        return;
      }

      const locality = getEditorLocalityFromFeature(feature as Feature<Geometry>);
      const coordinates = getEditorLocalityFeatureCoordinates(feature as Feature<Geometry>);

      if (!locality || !coordinates) {
        localityDragOriginRef.current = null;
        return;
      }

      localityDragOriginRef.current = {
        id_locality: locality.id_locality,
        coordinates,
        locality,
      };
      setHoverInfo(null);
      setLocalityDragging(true);
      setLocalityMoveError(null);
      selectLocality(locality);
    }) as EventsKey;

    const translateEndKey = translateInteraction.on("translateend", (event: unknown) => {
      void handleLocalityTranslateEnd(event);
    }) as EventsKey;

    const singleClickHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;

      if (editorToolRef.current === "create-point") {
        const [x, y] = event.coordinate;
        const caseFeature = map.forEachFeatureAtPixel(
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
        const caseId = caseFeature?.getId();
        setPointDraft(
          createPointDraft(referenceDataRef.current, {
            x,
            y,
            id_case_detected: typeof caseId === "string" ? caseId : null,
          }),
        );
        setLocalitySaveError(null);

        return;
      }

      if (landmarksVisibleRef.current) {
        const landmarkFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === landmarksLayer,
            hitTolerance: 10,
          },
        );

        if (landmarkFeature) {
          handleCloseLocalitySelection();
          setSelectedCaseId(null);
          return;
        }
      }

      if (localitiesVisibleRef.current) {
        const localityFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === localitiesLayer,
            hitTolerance: 10,
          },
        );

        if (localityFeature) {
          const locality = getEditorLocalityFromFeature(localityFeature as Feature<Geometry>);

          if (locality) {
            selectLocality(locality);
            return;
          }
        }
      }

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
        handleCloseLocalitySelection();
        setSelectedCaseId(null);
        return;
      }

      handleCloseLocalitySelection();
      const id = feature.getId();
      setSelectedCaseId(typeof id === "string" ? id : null);
    };

    const singleClickKey = map.on("singleclick", singleClickHandler);

    function getTooltipPosition(originalEvent: PointerEvent): { x: number; y: number } {
      const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
      const preferredX = originalEvent.clientX + 18;
      const preferredY = originalEvent.clientY + 18;
      const tooltipWidth = 240;
      const tooltipHeight = 120;

      return {
        x: viewportWidth > 0 ? Math.min(preferredX, viewportWidth - tooltipWidth) : preferredX,
        y:
          viewportHeight > 0 ? Math.min(preferredY, viewportHeight - tooltipHeight) : preferredY,
      };
    }

    const pointerMoveHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;
      const target = map.getTargetElement();

      if (localityDraggingRef.current) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      if (!casesVisibleRef.current && !localitiesVisibleRef.current && !landmarksVisibleRef.current) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      if (landmarksVisibleRef.current) {
        const landmarkFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === landmarksLayer,
            hitTolerance: 10,
          },
        );

        if (landmarkFeature) {
          const landmark = getEditorLandmarkFromFeature(landmarkFeature as Feature<Geometry>);

          if (landmark) {
            const typeOption = referenceDataRef.current?.landmark_types.find(
              (option) => option.value === landmark.type_key,
            );
            const category = typeOption?.category ?? landmarkCategoryByTypeRef.current[landmark.type_key] ?? null;

            target.style.cursor = "pointer";
            const position = getTooltipPosition(event.originalEvent);

            setHoverInfo({
              x: position.x,
              y: position.y,
              title: landmark.name,
              rows: [
                { label: "Type", value: typeOption?.label ?? landmark.type_key },
                { label: "Categorie", value: getLandmarkCategoryLabel(category) },
                { label: "Statut", value: landmark.status },
                landmark.id_case_detected
                  ? { label: "Case", value: landmark.id_case_detected }
                  : null,
              ].filter((row): row is { label: string; value: string } => row !== null),
            });

            return;
          }
        }
      }

      if (localitiesVisibleRef.current) {
        const localityFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === localitiesLayer,
            hitTolerance: 10,
          },
        );

        if (localityFeature) {
          const locality = getEditorLocalityFromFeature(localityFeature as Feature<Geometry>);

          if (locality) {
            target.style.cursor = "pointer";
            const position = getTooltipPosition(event.originalEvent);

            setHoverInfo({
              x: position.x,
              y: position.y,
              title: locality.name,
              rows: [
                { label: "Type", value: locality.type_key },
                { label: "Statut", value: locality.status },
                locality.id_case_detected
                  ? { label: "Case", value: locality.id_case_detected }
                  : null,
              ].filter((row): row is { label: string; value: string } => row !== null),
            });

            return;
          }
        }
      }

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
      const position = getTooltipPosition(event.originalEvent);

      setHoverInfo({
        x: position.x,
        y: position.y,
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

    async function loadLocalities() {
      setLocalitiesLoading(true);
      setLocalitiesError(null);

      try {
        const items = await fetchJson<EditorMapLocality[]>("/api/admin/editor/localities?limit=1000");

        if (cancelled || !localitiesSourceRef.current) {
          return;
        }

        replaceEditorLocalityFeatures(localitiesSourceRef.current, items);
        setLocalitiesCount(items.length);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Impossible de charger les localites dans l'editeur.", error);
        setLocalitiesCount(0);
        setLocalitiesError(
          error instanceof Error ? error.message : "Chargement des localites impossible.",
        );
      } finally {
        if (!cancelled) {
          setLocalitiesLoading(false);
        }
      }
    }

    async function loadLandmarks() {
      setLandmarksLoading(true);
      setLandmarksError(null);

      try {
        const items = await fetchJson<EditorMapLandmark[]>("/api/admin/editor/landmarks?limit=1000");

        if (cancelled || !landmarksSourceRef.current) {
          return;
        }

        replaceEditorLandmarkFeatures(landmarksSourceRef.current, items);
        setLandmarksCount(items.length);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Impossible de charger les landmarks dans l'editeur.", error);
        setLandmarksCount(0);
        setLandmarksError(
          error instanceof Error ? error.message : "Chargement des landmarks impossible.",
        );
      } finally {
        if (!cancelled) {
          setLandmarksLoading(false);
        }
      }
    }

    async function loadReferenceData() {
      try {
        const data = await fetchJson<EditorReferenceData>("/api/admin/editor/reference-data");

        if (!cancelled) {
          setReferenceData(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Impossible de charger les referentiels editeur.", error);
          setReferenceError(
            error instanceof Error ? error.message : "Chargement des referentiels impossible.",
          );
        }
      }
    }

    void loadCases();
    void loadLocalities();
    void loadLandmarks();
    void loadReferenceData();

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      unByKey(translateStartKey);
      unByKey(translateEndKey);
      unByKey(singleClickKey);
      unByKey(pointerMoveKey);
      map.removeInteraction(translateInteraction);
      map.getTargetElement().style.cursor = "";
      map.setTarget(undefined);
      casesSourceRef.current = null;
      casesLayerRef.current = null;
      localitiesSourceRef.current = null;
      localitiesLayerRef.current = null;
      landmarksSourceRef.current = null;
      landmarksLayerRef.current = null;
      localityTranslateInteractionRef.current = null;
      mapRef.current = null;
    };
  }, [handleLocalityTranslateEnd]);

  async function handleCreatePoint() {
    if (!pointDraft) {
      return;
    }

    const trimmedName = pointDraft.name.trim();

    if (!trimmedName) {
      setLocalitySaveError("Le nom est obligatoire.");
      return;
    }

    if (!pointDraft.type_key) {
      setLocalitySaveError("Le type est obligatoire.");
      return;
    }

    if (
      pointDraft.family === "unique" &&
      (referenceData?.map_icons.length ?? 0) > 0 &&
      !pointDraft.icon_key
    ) {
      setLocalitySaveError("L'icone est obligatoire pour un lieu unique.");
      return;
    }

    setLocalitySaving(true);
    setLocalitySaveError(null);

    try {
      if (pointDraft.family === "locality") {
        const payload: EditorMapLocalityInput = {
          name: trimmedName,
          type_key: pointDraft.type_key,
          icon_key: null,
          x: pointDraft.x,
          y: pointDraft.y,
          id_case_detected: pointDraft.id_case_detected,
          faction: null,
          controleur: null,
          status: "draft",
          depends_on_locality_id: null,
          description: pointDraft.description.trim() || null,
        };

        const created = await fetchJson<EditorMapLocality>("/api/admin/editor/localities", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (localitiesSourceRef.current) {
          upsertEditorLocalityFeature(localitiesSourceRef.current, created);
        }

        setLocalitiesCount((count) => (count === null ? 1 : count + 1));
        selectLocality(created);
      } else {
        const payload: EditorMapLandmarkInput = {
          name: trimmedName,
          type_key: pointDraft.family === "unique" ? "lieu_unique" : pointDraft.type_key,
          icon_key: pointDraft.family === "unique" ? pointDraft.icon_key : null,
          x: pointDraft.x,
          y: pointDraft.y,
          id_case_detected: pointDraft.id_case_detected,
          faction: null,
          controleur: null,
          status: "draft",
          description: pointDraft.description.trim() || null,
        };

        const created = await fetchJson<EditorMapLandmark>("/api/admin/editor/landmarks", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (landmarksSourceRef.current) {
          upsertEditorLandmarkFeature(landmarksSourceRef.current, created);
        }

        setLandmarksCount((count) => (count === null ? 1 : count + 1));
        handleCloseLocalitySelection();
        setSelectedCaseId(created.id_case_detected);
      }

      setPointDraft(null);
      setEditorTool("select");
    } catch (error) {
      setLocalitySaveError(
        error instanceof Error ? error.message : "Creation du point impossible.",
      );
    } finally {
      setLocalitySaving(false);
    }
  }

  async function handleSaveLocalityEdit() {
    if (!selectedLocality || !localityEditDraft) {
      return;
    }

    const name = localityEditDraft.name.trim();
    const typeKey = localityEditDraft.type_key.trim();

    if (!name || !typeKey) {
      setLocalityEditError("Le nom et le type sont obligatoires.");
      return;
    }

    setLocalityEditSaving(true);
    setLocalityEditError(null);

    try {
      const patch: EditorMapLocalityPatch = {
        name,
        type_key: typeKey,
        status: localityEditDraft.status,
        description:
          localityEditDraft.description.trim().length > 0
            ? localityEditDraft.description.trim()
            : null,
      };

      const updated = await fetchJson<EditorMapLocality>(
        `/api/admin/editor/localities/${encodeURIComponent(selectedLocality.id_locality)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );

      if (localitiesSourceRef.current) {
        upsertEditorLocalityFeature(localitiesSourceRef.current, updated);
      }

      const nextDraft = createLocalityEditDraft(updated);

      setSelectedLocality(updated);
      setLocalityEditDraft(nextDraft);
      setLocalityEditSnapshot(getLocalityEditSnapshot(nextDraft));
    } catch (error) {
      setLocalityEditError(
        error instanceof Error ? error.message : "Mise a jour de localite impossible.",
      );
    } finally {
      setLocalityEditSaving(false);
    }
  }

  return (
    <section className="relative min-h-[calc(100svh-5rem)] overflow-hidden rounded-[28px] bg-background/70">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex justify-end">
        <div className="pointer-events-auto max-h-[calc(100svh-8rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[20px] border border-border/80 bg-background/90 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
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
          <Button
            type="button"
            variant={editorTool === "create-point" ? "secondary" : "outline"}
            className="mt-2"
            disabled={
              !referenceData ||
              (referenceData.locality_types.length === 0 &&
                referenceData.landmark_types.length === 0)
            }
            onClick={() => {
              handleCloseLocalitySelection();
              setEditorTool((tool) => (tool === "create-point" ? "select" : "create-point"));
              setPointDraft(null);
              setLocalitySaveError(null);
            }}
          >
            {editorTool === "create-point" ? "Annuler la creation" : "Creer un point"}
          </Button>
          <Button
            type="button"
            variant={localitiesVisible ? "secondary" : "outline"}
            className="mt-2"
            onClick={() =>
              setLocalitiesVisible((visible) => {
                if (visible) {
                  setHoverInfo(null);
                }

                return !visible;
              })
            }
          >
            {localitiesVisible ? "Masquer les localites" : "Afficher les localites"}
          </Button>
          <Button
            type="button"
            variant={landmarksVisible ? "secondary" : "outline"}
            className="mt-2"
            onClick={() =>
              setLandmarksVisible((visible) => {
                if (visible) {
                  setHoverInfo(null);
                }

                return !visible;
              })
            }
          >
            {landmarksVisible ? "Masquer les landmarks" : "Afficher les landmarks"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() =>
              setLocalityDisplayMode((mode) => (mode === "icons" ? "points" : "icons"))
            }
          >
            {localityDisplayMode === "icons" ? "Mode points" : "Mode icones"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {casesLoading
              ? "Chargement des cases..."
              : casesCount !== null
                ? `${casesCount} cases chargees`
                : "Cases non chargees"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {localitiesLoading
              ? "Chargement des localites..."
              : localitiesCount !== null
                ? `${localitiesCount} localites chargees`
                : "Localites non chargees"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {landmarksLoading
              ? "Chargement des landmarks..."
              : landmarksCount !== null
                ? `${landmarksCount} landmarks charges`
                : "Landmarks non charges"}
          </p>
          {editorTool === "create-point" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Cliquez sur la carte pour placer le point.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedCaseId
              ? `Case selectionnee : ${selectedCaseId}`
              : "Aucune case selectionnee"}
          </p>
          {localityEditDirty ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Enregistrez ou annulez les modifications avant de deplacer la localite.
            </p>
          ) : null}
          {localityDragging ? (
            <p className="mt-2 text-xs text-muted-foreground">Deplacement en cours...</p>
          ) : null}
          {localityMoveSaving ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sauvegarde du deplacement...
            </p>
          ) : null}
          {localityMoveError ? (
            <p className="mt-2 text-xs text-destructive">{localityMoveError}</p>
          ) : null}
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
          {localitiesError ? (
            <p className="mt-2 text-xs text-destructive">{localitiesError}</p>
          ) : null}
          {landmarksError ? (
            <p className="mt-2 text-xs text-destructive">{landmarksError}</p>
          ) : null}
          {referenceError ? (
            <p className="mt-2 text-xs text-destructive">{referenceError}</p>
          ) : null}
          {pointDraft ? (
            <form
              className="mt-4 space-y-3 border-t border-border/70 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreatePoint();
              }}
            >
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Famille</span>
                <select
                  value={pointDraft.family}
                  onChange={(event) =>
                    setPointDraft((draft) =>
                      draft
                        ? changePointDraftFamily(
                            referenceData,
                            draft,
                            event.target.value as EditorCreateObjectFamily,
                          )
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="locality">Localite</option>
                  <option value="landmark">Landmark</option>
                  <option value="unique">Lieu unique</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Nom</span>
                <input
                  value={pointDraft.name}
                  onChange={(event) =>
                    setPointDraft((draft) =>
                      draft ? { ...draft, name: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              {pointDraft.family === "unique" ? (
                <label className="block text-xs text-muted-foreground">
                  <span className="mb-1 block">Type</span>
                  <input
                    value="Lieu unique"
                    readOnly
                    className="h-10 w-full rounded-xl border border-border/80 bg-background/60 px-3 text-sm text-foreground outline-none"
                  />
                </label>
              ) : (
                <label className="block text-xs text-muted-foreground">
                  <span className="mb-1 block">Type</span>
                  <select
                    value={pointDraft.type_key}
                    onChange={(event) =>
                      setPointDraft((draft) =>
                        draft ? { ...draft, type_key: event.target.value } : draft,
                      )
                    }
                    className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                  >
                    {(pointDraft.family === "locality"
                      ? referenceData?.locality_types ?? []
                      : (referenceData?.landmark_types ?? []).filter(
                          (option) => option.category !== "unique",
                        )
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {pointDraft.family === "unique" ? (
                <label className="block text-xs text-muted-foreground">
                  <span className="mb-1 block">Icone</span>
                  <select
                    value={pointDraft.icon_key ?? ""}
                    onChange={(event) =>
                      setPointDraft((draft) =>
                        draft
                          ? {
                              ...draft,
                              icon_key: event.target.value.trim().length > 0 ? event.target.value : null,
                            }
                          : draft,
                      )
                    }
                    className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                  >
                    <option value="">Aucune icone</option>
                    {(referenceData?.map_icons ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Description</span>
                <textarea
                  value={pointDraft.description}
                  onChange={(event) =>
                    setPointDraft((draft) =>
                      draft ? { ...draft, description: event.target.value } : draft,
                    )
                  }
                  className="min-h-24 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Coordonnees : {Math.round(pointDraft.x)}, {Math.round(pointDraft.y)}
              </p>
              <p className="text-xs text-muted-foreground">
                {pointDraft.id_case_detected
                  ? `Case detectee : ${pointDraft.id_case_detected}`
                  : "Aucune case detectee"}
              </p>
              {pointDraft.family === "unique" && (referenceData?.map_icons.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune icone active n&apos;est disponible. Le lieu unique sera cree avec le fallback visuel.
                </p>
              ) : null}
              <div className="sticky bottom-0 -mx-4 mt-4 space-y-2 border-t border-border/70 bg-background/95 px-4 py-3">
                {localitySaveError ? (
                  <p className="text-xs text-destructive">{localitySaveError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={localitySaving}>
                    {localitySaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPointDraft(null);
                      setLocalitySaveError(null);
                      setEditorTool("select");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
          {selectedLocality && localityEditDraft ? (
            <form
              className="mt-4 space-y-3 border-t border-border/70 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveLocalityEdit();
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Localite selectionnee
              </p>
              <p className="text-sm font-semibold text-foreground">{selectedLocality.name}</p>
              <p className="text-xs text-muted-foreground">
                Position : {Math.round(selectedLocality.x)}, {Math.round(selectedLocality.y)}
              </p>
              <p className="text-xs text-muted-foreground">
                Case : {selectedLocality.id_case_detected ?? "non detectee"}
              </p>
              <p className="text-xs text-muted-foreground">
                ID : {selectedLocality.id_locality}
              </p>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Nom</span>
                <input
                  value={localityEditDraft.name}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft ? { ...draft, name: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Type</span>
                <select
                  value={localityEditDraft.type_key}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft ? { ...draft, type_key: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  {referenceData?.locality_types.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Statut</span>
                <select
                  value={localityEditDraft.status}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            status: event.target.value as LocalityEditDraft["status"],
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Description</span>
                <textarea
                  value={localityEditDraft.description}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft ? { ...draft, description: event.target.value } : draft,
                    )
                  }
                  className="min-h-24 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
              <div className="sticky bottom-0 -mx-4 mt-4 space-y-2 border-t border-border/70 bg-background/95 px-4 py-3">
                {localityEditError ? (
                  <p className="text-xs text-destructive">{localityEditError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      localityEditSaving ||
                      localityEditDraft.name.trim().length === 0 ||
                      localityEditDraft.type_key.trim().length === 0 ||
                      !localityEditDirty
                    }
                  >
                    {localityEditSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={localityEditSaving || !localityEditDirty}
                    onClick={handleCancelLocalityEdit}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={localityEditSaving}
                    onClick={handleCloseLocalitySelection}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
      <div
        ref={mapElementRef}
        className="h-[calc(100svh-5rem)] w-full"
        aria-label="Carte editeur"
      />
      {hoverInfo && (casesVisible || localitiesVisible || landmarksVisible) ? (
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
