"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Collection from "ol/Collection";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
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
  EditorMapLandmarkPatch,
  EditorMapLocality,
  EditorMapLocalityInput,
  EditorMapLocalityPatch,
  EditorMapRoute,
  EditorMapRouteInput,
  EditorMapRoutePatch,
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
  createEditorPointsVectorLayer,
  createEditorPointsVectorSource,
  getEditorLandmarkFromPointFeature,
  getEditorLocalityFromPointFeature,
  getEditorPointFamilyFromFeature,
  getEditorPointFeatureCoordinates,
  replaceEditorPointFeatures,
  setEditorPointFeatureCoordinates,
  syncEditorPointsLayerVisibility,
  updateEditorPointFeature,
  upsertEditorPointFeature,
} from "@/map/openlayers/editor-points-layer";
import {
  clearEditorRouteVertexFeatures,
  createEditorRouteVerticesVectorLayer,
  createEditorRouteVerticesVectorSource,
  getEditorRouteVertexFromFeature,
  replaceEditorRouteVertexFeatures,
} from "@/map/openlayers/editor-route-vertices-layer";
import {
  clearEditorRoutePreview,
  createEditorRoutePreviewVectorLayer,
  createEditorRoutePreviewVectorSource,
  createEditorRoutesVectorLayer,
  createEditorRoutesVectorSource,
  getEditorRouteFromFeature,
  replaceEditorRoutePreviewFeatures,
  replaceEditorRouteFeatures,
  syncEditorRoutesLayerVisibility,
  upsertEditorRouteFeature,
} from "@/map/openlayers/editor-routes-layer";
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

type EditorTool = "select" | "create-point" | "create-route";
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
  icon_key: string | null;
  status: "draft" | "published" | "archived";
  description: string;
};

type LandmarkEditDraft = {
  id_landmark: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  status: "draft" | "published" | "archived";
  description: string;
};

type RouteCreateDraft = {
  name: string;
  route_type: string;
  geometry_mode: "straight" | "curved";
  stroke_style: "solid" | "dashed" | "dotted";
  stroke_width: number;
  stroke_color: string;
  description: string;
  points: Array<[number, number]>;
};

type RouteEditDraft = {
  id_route: string;
  name: string;
  route_type: string;
  geometry_mode: "straight" | "curved";
  stroke_style: "solid" | "dashed" | "dotted";
  stroke_width: number;
  stroke_color: string;
  status: "draft" | "published" | "archived";
  description: string;
};

type RouteGeometryEditDraft = {
  id_route: string;
  points: Array<[number, number]>;
};

type RouteGeometryTool = "select-vertex" | "append-vertex" | "insert-vertex";

type DragOrigin =
  | {
      family: "locality";
      id: string;
      coordinates: [number, number];
      locality: EditorMapLocality;
    }
  | {
      family: "landmark";
      id: string;
      coordinates: [number, number];
      landmark: EditorMapLandmark;
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
    icon_key: locality.icon_key,
    status: locality.status,
    description: locality.description ?? "",
  };
}

function createLandmarkEditDraft(landmark: EditorMapLandmark): LandmarkEditDraft {
  return {
    id_landmark: landmark.id_landmark,
    name: landmark.name,
    type_key: landmark.type_key,
    icon_key: landmark.icon_key,
    status: landmark.status,
    description: landmark.description ?? "",
  };
}

function getLandmarkCategoryLabel(category: string | null | undefined): string {
  return category === "unique" ? "Lieu unique" : "Landmark";
}

function getRouteGeometryLabel(geometryMode: EditorMapRoute["geometry_mode"]): string {
  return geometryMode === "straight" ? "Droite" : "Courbe";
}

function getRouteStrokeStyleLabel(strokeStyle: EditorMapRoute["stroke_style"]): string {
  if (strokeStyle === "dashed") {
    return "Tirets";
  }

  if (strokeStyle === "dotted") {
    return "Points";
  }

  return "Plein";
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

function getLandmarkEditSnapshot(draft: LandmarkEditDraft): string {
  return JSON.stringify(draft);
}

function createEmptyRouteDraft(): RouteCreateDraft {
  return {
    name: "",
    route_type: "route",
    geometry_mode: "curved",
    stroke_style: "solid",
    stroke_width: 3,
    stroke_color: "#ffffff",
    description: "",
    points: [],
  };
}

function createRouteEditDraft(route: EditorMapRoute): RouteEditDraft {
  return {
    id_route: route.id_route,
    name: route.name,
    route_type: route.route_type,
    geometry_mode: route.geometry_mode,
    stroke_style: route.stroke_style,
    stroke_width: route.stroke_width,
    stroke_color: route.stroke_color ?? "",
    status: route.status,
    description: route.description ?? "",
  };
}

function isValidRouteColor(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return true;
  }

  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed);
}

function normalizeColorInput(value: string): string {
  const trimmed = value.trim();

  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    const hex = trimmed.slice(1);

    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }

  return "#ffffff";
}

function getRouteEditSnapshot(draft: RouteEditDraft): string {
  return JSON.stringify(draft);
}

function createRouteGeometryDraft(route: EditorMapRoute): RouteGeometryEditDraft {
  return {
    id_route: route.id_route,
    points: route.points.map(([x, y]) => [x, y]),
  };
}

function getRouteGeometrySnapshot(points: Array<[number, number]>): string {
  return JSON.stringify(points);
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
  const routesSourceRef = useRef<ReturnType<typeof createEditorRoutesVectorSource> | null>(null);
  const routesLayerRef = useRef<ReturnType<typeof createEditorRoutesVectorLayer> | null>(null);
  const routePreviewSourceRef = useRef<ReturnType<typeof createEditorRoutePreviewVectorSource> | null>(null);
  const routePreviewLayerRef = useRef<ReturnType<typeof createEditorRoutePreviewVectorLayer> | null>(null);
  const routeVerticesSourceRef =
    useRef<ReturnType<typeof createEditorRouteVerticesVectorSource> | null>(null);
  const routeVerticesLayerRef =
    useRef<ReturnType<typeof createEditorRouteVerticesVectorLayer> | null>(null);
  const pointsSourceRef = useRef<ReturnType<typeof createEditorPointsVectorSource> | null>(
    null,
  );
  const pointsLayerRef = useRef<ReturnType<typeof createEditorPointsVectorLayer> | null>(
    null,
  );
  const casesVisibleRef = useRef(true);
  const routesVisibleRef = useRef(true);
  const localitiesVisibleRef = useRef(true);
  const landmarksVisibleRef = useRef(true);
  const localityDisplayModeRef = useRef<LocalityDisplayMode>("icons");
  const selectedCaseIdRef = useRef<string | null>(null);
  const selectedLocalityIdRef = useRef<string | null>(null);
  const selectedLandmarkIdRef = useRef<string | null>(null);
  const selectedRouteIdRef = useRef<string | null>(null);
  const routeGeometryDraftRef = useRef<RouteGeometryEditDraft | null>(null);
  const routeGeometryToolRef = useRef<RouteGeometryTool>("select-vertex");
  const selectedRouteVertexIndexRef = useRef<number | null>(null);
  const routeGeometryDraggingRef = useRef(false);
  const editorToolRef = useRef<EditorTool>("select");
  const localityDraftOpenRef = useRef(false);
  const localityDraggingRef = useRef(false);
  const localityMoveSavingRef = useRef(false);
  const localityTranslateInteractionRef = useRef<Translate | null>(null);
  const routeVertexTranslateInteractionRef = useRef<Translate | null>(null);
  const localityDragOriginRef = useRef<DragOrigin | null>(null);
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
  const [routesVisible, setRoutesVisible] = useState(true);
  const [routesCount, setRoutesCount] = useState<number | null>(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
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
  const [selectedLandmark, setSelectedLandmark] = useState<EditorMapLandmark | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<EditorMapRoute | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [pointDraft, setPointDraft] = useState<MapObjectCreateDraft | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteCreateDraft | null>(null);
  const [localitySaving, setLocalitySaving] = useState(false);
  const [localitySaveError, setLocalitySaveError] = useState<string | null>(null);
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeSaveError, setRouteSaveError] = useState<string | null>(null);
  const [routeEditDraft, setRouteEditDraft] = useState<RouteEditDraft | null>(null);
  const [routeEditSnapshot, setRouteEditSnapshot] = useState<string | null>(null);
  const [routeEditSaving, setRouteEditSaving] = useState(false);
  const [routeEditError, setRouteEditError] = useState<string | null>(null);
  const [routeGeometryDraft, setRouteGeometryDraft] = useState<RouteGeometryEditDraft | null>(
    null,
  );
  const [routeGeometrySnapshot, setRouteGeometrySnapshot] = useState<string | null>(null);
  const [selectedRouteVertexIndex, setSelectedRouteVertexIndex] = useState<number | null>(null);
  const [routeGeometrySaving, setRouteGeometrySaving] = useState(false);
  const [routeGeometryError, setRouteGeometryError] = useState<string | null>(null);
  const [routeGeometryDragging, setRouteGeometryDragging] = useState(false);
  const [routeGeometryTool, setRouteGeometryTool] =
    useState<RouteGeometryTool>("select-vertex");
  const [localityEditDraft, setLocalityEditDraft] = useState<LocalityEditDraft | null>(null);
  const [localityEditSnapshot, setLocalityEditSnapshot] = useState<string | null>(null);
  const [landmarkEditDraft, setLandmarkEditDraft] = useState<LandmarkEditDraft | null>(null);
  const [landmarkEditSnapshot, setLandmarkEditSnapshot] = useState<string | null>(null);
  const [localityEditSaving, setLocalityEditSaving] = useState(false);
  const [localityEditError, setLocalityEditError] = useState<string | null>(null);
  const [localityDragging, setLocalityDragging] = useState(false);
  const [localityMoveSaving, setLocalityMoveSaving] = useState(false);
  const [localityMoveError, setLocalityMoveError] = useState<string | null>(null);

  const localityEditDirty =
    localityEditDraft && localityEditSnapshot
      ? getLocalityEditSnapshot(localityEditDraft) !== localityEditSnapshot
      : false;
  const landmarkEditDirty =
    landmarkEditDraft && landmarkEditSnapshot
      ? getLandmarkEditSnapshot(landmarkEditDraft) !== landmarkEditSnapshot
      : false;
  const routeEditDirty =
    routeEditDraft && routeEditSnapshot
      ? getRouteEditSnapshot(routeEditDraft) !== routeEditSnapshot
      : false;
  const routeGeometryDirty =
    routeGeometryDraft && routeGeometrySnapshot
      ? getRouteGeometrySnapshot(routeGeometryDraft.points) !== routeGeometrySnapshot
      : false;
  const routeColorValid = routeDraft ? isValidRouteColor(routeDraft.stroke_color) : true;
  const routeEditColorValid = routeEditDraft
    ? isValidRouteColor(routeEditDraft.stroke_color)
    : true;

  useEffect(() => {
    casesVisibleRef.current = casesVisible;
    syncCaseLayerVisibility(casesLayerRef.current, casesVisible);

    if (!casesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
  }, [casesVisible]);

  useEffect(() => {
    routesVisibleRef.current = routesVisible;
    syncEditorRoutesLayerVisibility(routesLayerRef.current, routesVisible);

    if (!routesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
  }, [routesVisible]);

  useEffect(() => {
    localitiesVisibleRef.current = localitiesVisible;
    syncEditorPointsLayerVisibility(pointsLayerRef.current, localitiesVisible || landmarksVisible);

    if (!localitiesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
    pointsLayerRef.current?.changed();
  }, [localitiesVisible, landmarksVisible]);

  useEffect(() => {
    landmarksVisibleRef.current = landmarksVisible;
    syncEditorPointsLayerVisibility(pointsLayerRef.current, localitiesVisible || landmarksVisible);

    if (!landmarksVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
    pointsLayerRef.current?.changed();
  }, [landmarksVisible, localitiesVisible]);

  useEffect(() => {
    localityDisplayModeRef.current = localityDisplayMode;
    pointsLayerRef.current?.changed();
  }, [localityDisplayMode]);

  useEffect(() => {
    editorToolRef.current = editorTool;
  }, [editorTool]);

  useEffect(() => {
    if (!routePreviewSourceRef.current) {
      return;
    }

    if (routeDraft && routeDraft.points.length > 0) {
      replaceEditorRoutePreviewFeatures(routePreviewSourceRef.current, {
        ...routeDraft,
        status: "draft",
      });
      return;
    }

    if (routeGeometryDraft && selectedRoute) {
      replaceEditorRoutePreviewFeatures(routePreviewSourceRef.current, {
        ...selectedRoute,
        points: routeGeometryDraft.points,
        geometry_mode: routeEditDraft?.geometry_mode ?? selectedRoute.geometry_mode,
        stroke_style: routeEditDraft?.stroke_style ?? selectedRoute.stroke_style,
        stroke_width: routeEditDraft?.stroke_width ?? selectedRoute.stroke_width,
        stroke_color: routeEditDraft?.stroke_color ?? selectedRoute.stroke_color ?? "",
      });
      return;
    }

    clearEditorRoutePreview(routePreviewSourceRef.current);
  }, [routeDraft, routeGeometryDraft, routeEditDraft, selectedRoute]);

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
    if (!routeVerticesSourceRef.current || !routeVerticesLayerRef.current) {
      return;
    }

    if (!routeGeometryDraft || !selectedRoute) {
      clearEditorRouteVertexFeatures(routeVerticesSourceRef.current);
      routeVerticesLayerRef.current.setVisible(false);
      return;
    }

    replaceEditorRouteVertexFeatures(
      routeVerticesSourceRef.current,
      routeGeometryDraft.id_route,
      routeGeometryDraft.points,
      selectedRouteVertexIndex,
    );
    routeVerticesLayerRef.current.setVisible(true);
    routeVerticesLayerRef.current.changed();
  }, [routeGeometryDraft, selectedRoute, selectedRouteVertexIndex]);

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
      pointsLayerRef.current?.changed();
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
    selectedLandmarkIdRef.current = selectedLandmark?.id_landmark ?? null;
  }, [selectedLandmark]);

  useEffect(() => {
    selectedRouteIdRef.current = selectedRoute?.id_route ?? null;
  }, [selectedRoute]);

  useEffect(() => {
    routeGeometryDraftRef.current = routeGeometryDraft;
  }, [routeGeometryDraft]);

  useEffect(() => {
    routeGeometryToolRef.current = routeGeometryTool;
  }, [routeGeometryTool]);

  useEffect(() => {
    selectedRouteVertexIndexRef.current = selectedRouteVertexIndex;
  }, [selectedRouteVertexIndex]);

  useEffect(() => {
    routeGeometryDraggingRef.current = routeGeometryDragging;
  }, [routeGeometryDragging]);

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
      (localitiesVisible || landmarksVisible) &&
        editorTool === "select" &&
        !pointDraft &&
        !routeGeometryDraft &&
        !localityMoveSaving &&
        !localityEditDirty &&
        !landmarkEditDirty,
    );
  }, [
    editorTool,
    pointDraft,
    routeGeometryDraft,
    localityEditDirty,
    landmarkEditDirty,
    localityMoveSaving,
    localitiesVisible,
    landmarksVisible,
  ]);

  useEffect(() => {
    const interaction = routeVertexTranslateInteractionRef.current;

    if (!interaction) {
      return;
    }

    interaction.setActive(
      routeGeometryDraft !== null &&
        routeGeometryTool === "select-vertex" &&
        editorTool === "select" &&
        !pointDraft &&
        !routeDraft &&
        !routeGeometrySaving,
    );
  }, [
    editorTool,
    pointDraft,
    routeDraft,
    routeGeometryDraft,
    routeGeometrySaving,
    routeGeometryTool,
  ]);

  const handleCloseLocalitySelection = useCallback(() => {
    setSelectedLocality(null);
    setSelectedLandmark(null);
    setLocalityEditDraft(null);
    setLocalityEditSnapshot(null);
    setLandmarkEditDraft(null);
    setLandmarkEditSnapshot(null);
    setLocalityEditError(null);
  }, []);

  const handleCloseRouteSelection = useCallback(() => {
    setSelectedRoute(null);
    setRouteEditDraft(null);
    setRouteEditSnapshot(null);
    setRouteEditError(null);
    setRouteGeometryDraft(null);
    setRouteGeometrySnapshot(null);
    setSelectedRouteVertexIndex(null);
    setRouteGeometryError(null);
    setRouteGeometryTool("select-vertex");
  }, []);

  const handleEnterRouteGeometryEdit = useCallback(() => {
    if (!selectedRoute) {
      return;
    }

    const draft = createRouteGeometryDraft(selectedRoute);

    setRouteGeometryDraft(draft);
    setRouteGeometrySnapshot(getRouteGeometrySnapshot(draft.points));
    setSelectedRouteVertexIndex(null);
    setRouteGeometryError(null);
    setRouteGeometryTool("select-vertex");
  }, [selectedRoute]);

  const handleCancelRouteGeometryEdit = useCallback(() => {
    if (selectedRoute) {
      const draft = createRouteGeometryDraft(selectedRoute);
      setRouteGeometryDraft(draft);
      setRouteGeometrySnapshot(getRouteGeometrySnapshot(draft.points));
    } else {
      setRouteGeometryDraft(null);
      setRouteGeometrySnapshot(null);
    }

    setSelectedRouteVertexIndex(null);
    setRouteGeometryError(null);
    setRouteGeometryTool("select-vertex");
  }, [selectedRoute]);

  const handleCloseRouteGeometryEdit = useCallback(() => {
    setRouteGeometryDraft(null);
    setRouteGeometrySnapshot(null);
    setSelectedRouteVertexIndex(null);
    setRouteGeometryError(null);
    setRouteGeometryTool("select-vertex");
  }, []);

  function handleToolChangeBlockedByRouteGeometry(): boolean {
    if (!routeGeometryDraft) {
      return false;
    }

    if (routeGeometryDirty) {
      setRouteGeometryError(
        "Enregistrez ou annulez la geometrie avant de changer d'outil.",
      );
      return true;
    }

    handleCloseRouteGeometryEdit();
    return false;
  }

  function handleCancelRouteCreate() {
    setRouteDraft(null);
    setRouteSaveError(null);
    setEditorTool("select");
    if (routePreviewSourceRef.current) {
      clearEditorRoutePreview(routePreviewSourceRef.current);
    }
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

  const selectLocality = useCallback((locality: EditorMapLocality) => {
    const draft = createLocalityEditDraft(locality);

    setSelectedLocality(locality);
    setSelectedLandmark(null);
    setLocalityEditDraft(draft);
    setLocalityEditSnapshot(getLocalityEditSnapshot(draft));
    setLandmarkEditDraft(null);
    setLandmarkEditSnapshot(null);
    setLocalityEditError(null);
    setPointDraft(null);
    setRouteDraft(null);
    setRouteSaveError(null);
    handleCloseRouteSelection();
    setSelectedCaseId(null);
    setEditorTool("select");
  }, [handleCloseRouteSelection]);

  function handleCancelLandmarkEdit() {
    if (!selectedLandmark) {
      return;
    }

    const draft = createLandmarkEditDraft(selectedLandmark);

    setLandmarkEditDraft(draft);
    setLandmarkEditSnapshot(getLandmarkEditSnapshot(draft));
    setLocalityEditError(null);
  }

  const selectLandmark = useCallback((landmark: EditorMapLandmark) => {
    const draft = createLandmarkEditDraft(landmark);

    setSelectedLandmark(landmark);
    setSelectedLocality(null);
    setLandmarkEditDraft(draft);
    setLandmarkEditSnapshot(getLandmarkEditSnapshot(draft));
    setLocalityEditDraft(null);
    setLocalityEditSnapshot(null);
    setLocalityEditError(null);
    setPointDraft(null);
    setRouteDraft(null);
    setRouteSaveError(null);
    handleCloseRouteSelection();
    setSelectedCaseId(null);
    setEditorTool("select");
  }, [handleCloseRouteSelection]);

  function handleCancelRouteEdit() {
    if (!selectedRoute) {
      return;
    }

    const draft = createRouteEditDraft(selectedRoute);

    setRouteEditDraft(draft);
    setRouteEditSnapshot(getRouteEditSnapshot(draft));
    setRouteEditError(null);
  }

  const selectRoute = useCallback((route: EditorMapRoute) => {
    const draft = createRouteEditDraft(route);

    handleCloseLocalitySelection();
    handleCloseRouteGeometryEdit();
    setSelectedRoute(route);
    setRouteEditDraft(draft);
    setRouteEditSnapshot(getRouteEditSnapshot(draft));
    setRouteEditError(null);
    setPointDraft(null);
    setRouteDraft(null);
    setRouteSaveError(null);
    if (routePreviewSourceRef.current) {
      clearEditorRoutePreview(routePreviewSourceRef.current);
    }
    setSelectedCaseId(null);
    setEditorTool("select");
  }, [handleCloseLocalitySelection, handleCloseRouteGeometryEdit]);

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

    const locality =
      origin.family === "locality" ? getEditorLocalityFromPointFeature(feature) : null;
    const landmark =
      origin.family === "landmark" ? getEditorLandmarkFromPointFeature(feature) : null;
    const coordinates = getEditorPointFeatureCoordinates(feature);

    if (!coordinates) {
      setEditorPointFeatureCoordinates(feature, origin.coordinates);
      updateEditorPointFeature(
        feature,
        origin.family === "locality"
          ? { family: "locality", locality: origin.locality }
          : { family: "landmark", landmark: origin.landmark },
      );
      return;
    }

    if (origin.family === "locality" && !locality) {
      setEditorPointFeatureCoordinates(feature, origin.coordinates);
      updateEditorPointFeature(feature, { family: "locality", locality: origin.locality });
      return;
    }

    if (origin.family === "landmark" && !landmark) {
      setEditorPointFeatureCoordinates(feature, origin.coordinates);
      updateEditorPointFeature(feature, { family: "landmark", landmark: origin.landmark });
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
      if (origin.family === "locality" && locality) {
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

        if (pointsSourceRef.current) {
          upsertEditorPointFeature(pointsSourceRef.current, {
            family: "locality",
            locality: updated,
          });
        }

        if (selectedLocalityIdRef.current === updated.id_locality) {
          const nextDraft = createLocalityEditDraft(updated);

          setSelectedLocality(updated);
          setLocalityEditDraft(nextDraft);
          setLocalityEditSnapshot(getLocalityEditSnapshot(nextDraft));
        }
      } else if (origin.family === "landmark" && landmark) {
        const updated = await fetchJson<EditorMapLandmark>(
          `/api/admin/editor/landmarks/${encodeURIComponent(landmark.id_landmark)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              x,
              y,
              id_case_detected: idCaseDetected,
            } satisfies Pick<EditorMapLandmarkPatch, "x" | "y" | "id_case_detected">),
          },
        );

        if (pointsSourceRef.current) {
          upsertEditorPointFeature(pointsSourceRef.current, {
            family: "landmark",
            landmark: updated,
          });
        }

        if (selectedLandmarkIdRef.current === updated.id_landmark) {
          const nextDraft = createLandmarkEditDraft(updated);

          setSelectedLandmark(updated);
          setLandmarkEditDraft(nextDraft);
          setLandmarkEditSnapshot(getLandmarkEditSnapshot(nextDraft));
        }
      }
    } catch (error) {
      if (origin.family === "locality") {
        setEditorPointFeatureCoordinates(feature, origin.coordinates);
        updateEditorPointFeature(feature, { family: "locality", locality: origin.locality });
      } else {
        setEditorPointFeatureCoordinates(feature, origin.coordinates);
        updateEditorPointFeature(feature, { family: "landmark", landmark: origin.landmark });
      }
      setLocalityMoveError(
        error instanceof Error ? error.message : "Deplacement du point impossible.",
      );
    } finally {
      setLocalityMoveSaving(false);
    }
  }, [detectCaseIdAtCoordinate]);

  const handleRouteVertexTranslateEnd = useCallback((rawEvent: unknown) => {
    const feature = getFirstTranslatedFeature(rawEvent);

    setRouteGeometryDragging(false);

    if (!(feature instanceof Feature)) {
      return;
    }

    const routeVertex = getEditorRouteVertexFromFeature(feature as Feature<Geometry>);
    const geometry = feature.getGeometry();

    if (!routeVertex || !(geometry instanceof Point)) {
      return;
    }

    const currentDraft = routeGeometryDraftRef.current;

    if (!currentDraft || routeVertex.routeId !== currentDraft.id_route) {
      return;
    }

    const coordinates = geometry.getCoordinates();

    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      return;
    }

    setRouteGeometryDraft((draft) => {
      if (!draft || draft.id_route !== routeVertex.routeId) {
        return draft;
      }

      return {
        ...draft,
        points: draft.points.map((point, index) =>
          index === routeVertex.vertexIndex
            ? [coordinates[0], coordinates[1]]
            : point,
        ),
      };
    });
    setSelectedRouteVertexIndex(routeVertex.vertexIndex);
  }, []);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const backgroundLayer = createCdtmBackgroundLayer();
    const casesSource = createCasesVectorSource();
    const routesSource = createEditorRoutesVectorSource();
    const routePreviewSource = createEditorRoutePreviewVectorSource();
    const routeVerticesSource = createEditorRouteVerticesVectorSource();
    const pointsSource = createEditorPointsVectorSource();
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
    const pointsLayer = createEditorPointsVectorLayer(pointsSource, {
      context: {
        getIconImagePath: (iconKey) =>
          iconKey ? mapIconSourceByKeyRef.current[iconKey] ?? null : null,
        getLocalityDefaultIconKeyForType: (typeKey) =>
          localityDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getLandmarkDefaultIconKeyForType: (typeKey) =>
          landmarkDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getLandmarkTypeCategory: (typeKey) => landmarkCategoryByTypeRef.current[typeKey] ?? null,
        getDisplayMode: () => localityDisplayModeRef.current,
        isFamilyVisible: (family) =>
          family === "locality" ? localitiesVisibleRef.current : landmarksVisibleRef.current,
      },
      visible: localitiesVisibleRef.current || landmarksVisibleRef.current,
    });
    const routesLayer = createEditorRoutesVectorLayer(routesSource, {
      visible: routesVisibleRef.current,
    });
    const routePreviewLayer = createEditorRoutePreviewVectorLayer(routePreviewSource, {
      visible: true,
    });
    const routeVerticesLayer = createEditorRouteVerticesVectorLayer(routeVerticesSource, {
      visible: false,
    });
    const map = createCdtmMap(mapElementRef.current, [
      backgroundLayer,
      casesLayer,
      routesLayer,
      routePreviewLayer,
      pointsLayer,
      routeVerticesLayer,
    ]);
    const translateInteraction = new Translate({
      layers: [pointsLayer],
    });
    const routeVertexTranslateInteraction = new Translate({
      layers: [routeVerticesLayer],
    });

    casesSourceRef.current = casesSource;
    casesLayerRef.current = casesLayer;
    routesSourceRef.current = routesSource;
    routesLayerRef.current = routesLayer;
    routePreviewSourceRef.current = routePreviewSource;
    routePreviewLayerRef.current = routePreviewLayer;
    routeVerticesSourceRef.current = routeVerticesSource;
    routeVerticesLayerRef.current = routeVerticesLayer;
    pointsSourceRef.current = pointsSource;
    pointsLayerRef.current = pointsLayer;
    localityTranslateInteractionRef.current = translateInteraction;
    routeVertexTranslateInteractionRef.current = routeVertexTranslateInteraction;
    mapRef.current = map;
    fitCdtmCasesExtent(map, 0);
    map.addInteraction(translateInteraction);
    map.addInteraction(routeVertexTranslateInteraction);

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

      const locality = getEditorLocalityFromPointFeature(feature as Feature<Geometry>);
      const localityCoordinates = getEditorPointFeatureCoordinates(feature as Feature<Geometry>);

      if (locality && localityCoordinates) {
        localityDragOriginRef.current = {
          family: "locality",
          id: locality.id_locality,
          coordinates: localityCoordinates,
          locality,
        };
        setHoverInfo(null);
        setLocalityDragging(true);
        setLocalityMoveError(null);
        selectLocality(locality);
        return;
      }

      const landmark = getEditorLandmarkFromPointFeature(feature as Feature<Geometry>);
      const landmarkCoordinates = getEditorPointFeatureCoordinates(feature as Feature<Geometry>);

      if (landmark && landmarkCoordinates) {
        localityDragOriginRef.current = {
          family: "landmark",
          id: landmark.id_landmark,
          coordinates: landmarkCoordinates,
          landmark,
        };
        setHoverInfo(null);
        setLocalityDragging(true);
        setLocalityMoveError(null);
        selectLandmark(landmark);
        return;
      }

      localityDragOriginRef.current = null;
    }) as EventsKey;

    const translateEndKey = translateInteraction.on("translateend", (event: unknown) => {
      void handleLocalityTranslateEnd(event);
    }) as EventsKey;

    const routeVertexTranslateStartKey = routeVertexTranslateInteraction.on(
      "translatestart",
      (event: unknown) => {
        const feature = getFirstTranslatedFeature(event);

        if (!(feature instanceof Feature)) {
          return;
        }

        const routeVertex = getEditorRouteVertexFromFeature(feature as Feature<Geometry>);

        if (!routeVertex || routeVertex.routeId !== selectedRouteIdRef.current) {
          return;
        }

        setSelectedRouteVertexIndex(routeVertex.vertexIndex);
        setRouteGeometryDragging(true);
        setRouteGeometryError(null);
        setHoverInfo(null);
      },
    ) as EventsKey;

    const routeVertexTranslateEndKey = routeVertexTranslateInteraction.on(
      "translateend",
      (event: unknown) => {
        handleRouteVertexTranslateEnd(event);
      },
    ) as EventsKey;

    const singleClickHandler = (rawEvent: unknown) => {
      const event = rawEvent as MapBrowserEvent<PointerEvent>;

      if (editorToolRef.current === "create-route") {
        const [x, y] = event.coordinate;
        setRouteDraft((draft) => {
          const nextDraft = draft ?? createEmptyRouteDraft();

          return {
            ...nextDraft,
            points: [...nextDraft.points, [x, y]],
          };
        });
        setHoverInfo(null);
        setRouteSaveError(null);
        return;
      }

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
        handleCloseRouteSelection();
        setLocalitySaveError(null);

        return;
      }

      const currentRouteGeometryDraft = routeGeometryDraftRef.current;
      const currentRouteGeometryTool = routeGeometryToolRef.current;
      const currentSelectedRouteVertexIndex = selectedRouteVertexIndexRef.current;

      if (currentRouteGeometryDraft) {
        const vertexFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === routeVerticesLayer,
            hitTolerance: 10,
          },
        );

        if (vertexFeature) {
          const routeVertex = getEditorRouteVertexFromFeature(
            vertexFeature as Feature<Geometry>,
          );

          if (routeVertex && routeVertex.routeId === currentRouteGeometryDraft.id_route) {
            setSelectedRouteVertexIndex(routeVertex.vertexIndex);
            setRouteGeometryTool("select-vertex");
            setRouteGeometryError(null);
            return;
          }
        }

        if (currentRouteGeometryTool === "append-vertex") {
          const [x, y] = event.coordinate;
          const nextIndex = currentRouteGeometryDraft.points.length;

          setRouteGeometryDraft({
            ...currentRouteGeometryDraft,
            points: [...currentRouteGeometryDraft.points, [x, y]],
          });
          setSelectedRouteVertexIndex(nextIndex);
          setRouteGeometryTool("select-vertex");
          setRouteGeometryError(null);
          setHoverInfo(null);
          return;
        }

        if (
          currentRouteGeometryTool === "insert-vertex" &&
          currentSelectedRouteVertexIndex !== null
        ) {
          const [x, y] = event.coordinate;
          const nextIndex = currentSelectedRouteVertexIndex + 1;
          const nextPoints = [...currentRouteGeometryDraft.points];

          nextPoints.splice(nextIndex, 0, [x, y]);
          setRouteGeometryDraft({
            ...currentRouteGeometryDraft,
            points: nextPoints,
          });
          setSelectedRouteVertexIndex(nextIndex);
          setRouteGeometryTool("select-vertex");
          setRouteGeometryError(null);
          setHoverInfo(null);
          return;
        }

        setSelectedRouteVertexIndex(null);
        setHoverInfo(null);
        return;
      }

      if (landmarksVisibleRef.current || localitiesVisibleRef.current) {
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

        if (pointFeature) {
          const family = getEditorPointFamilyFromFeature(pointFeature as Feature<Geometry>);
          if (family === "landmark") {
            const landmark = getEditorLandmarkFromPointFeature(pointFeature as Feature<Geometry>);
            if (landmark) {
              selectLandmark(landmark);
            }
            return;
          }
          if (family === "locality") {
            const locality = getEditorLocalityFromPointFeature(pointFeature as Feature<Geometry>);
            if (locality) {
              selectLocality(locality);
            }
          }
          return;
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
            hitTolerance: 6,
          },
        );

        if (routeFeature) {
          const route = getEditorRouteFromFeature(routeFeature as Feature<Geometry>);

          if (route) {
            selectRoute(route);
            return;
          }
        }
      }

      if (!casesVisibleRef.current) {
        handleCloseLocalitySelection();
        handleCloseRouteSelection();
        setSelectedCaseId(null);
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
        handleCloseRouteSelection();
        setSelectedCaseId(null);
        return;
      }

      handleCloseLocalitySelection();
      handleCloseRouteSelection();
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

      if (routeGeometryDraggingRef.current) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      if (editorToolRef.current === "create-route") {
        target.style.cursor = "crosshair";
        setHoverInfo(null);
        return;
      }

      if (routeGeometryDraftRef.current && routeGeometryToolRef.current !== "select-vertex") {
        target.style.cursor = "crosshair";
        setHoverInfo(null);
        return;
      }

      if (routeGeometryDraftRef.current) {
        const vertexFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) => candidateLayer === routeVerticesLayer,
            hitTolerance: 10,
          },
        );

        if (vertexFeature) {
          target.style.cursor = "pointer";
        } else {
          target.style.cursor = "";
        }
        setHoverInfo(null);
        return;
      }

      if (
        !casesVisibleRef.current &&
        !routesVisibleRef.current &&
        !localitiesVisibleRef.current &&
        !landmarksVisibleRef.current
      ) {
        target.style.cursor = "";
        setHoverInfo(null);
        return;
      }

      if (landmarksVisibleRef.current || localitiesVisibleRef.current) {
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

        if (pointFeature) {
          const family = getEditorPointFamilyFromFeature(pointFeature as Feature<Geometry>);
          if (family === "landmark") {
            const landmark = getEditorLandmarkFromPointFeature(pointFeature as Feature<Geometry>);
            if (landmark) {
              const typeOption = referenceDataRef.current?.landmark_types.find(
                (option) => option.value === landmark.type_key,
              );
              const category =
                typeOption?.category ?? landmarkCategoryByTypeRef.current[landmark.type_key] ?? null;
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
          if (family === "locality") {
            const locality = getEditorLocalityFromPointFeature(pointFeature as Feature<Geometry>);
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
            hitTolerance: 6,
          },
        );

        if (routeFeature) {
          const route = getEditorRouteFromFeature(routeFeature as Feature<Geometry>);

          if (route) {
            target.style.cursor = "pointer";
            const position = getTooltipPosition(event.originalEvent);
            setHoverInfo({
              x: position.x,
              y: position.y,
              title: route.name,
              rows: [
                { label: "Type", value: route.route_type },
                { label: "Geometrie", value: getRouteGeometryLabel(route.geometry_mode) },
                { label: "Style", value: getRouteStrokeStyleLabel(route.stroke_style) },
                { label: "Statut", value: route.status },
                { label: "Points", value: String(route.points.length) },
              ],
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

    async function loadRoutes() {
      setRoutesLoading(true);
      setRoutesError(null);

      try {
        const items = await fetchJson<EditorMapRoute[]>("/api/admin/editor/routes?limit=1000");

        if (cancelled || !routesSourceRef.current) {
          return;
        }

        replaceEditorRouteFeatures(routesSourceRef.current, items);
        setRoutesCount(items.length);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Impossible de charger les routes dans l'editeur.", error);
        setRoutesCount(0);
        setRoutesError(error instanceof Error ? error.message : "Chargement des routes impossible.");
      } finally {
        if (!cancelled) {
          setRoutesLoading(false);
        }
      }
    }

    async function loadLocalities() {
      setLocalitiesLoading(true);
      setLocalitiesError(null);

      try {
        const items = await fetchJson<EditorMapLocality[]>("/api/admin/editor/localities?limit=1000");

        if (cancelled || !pointsSourceRef.current) {
          return;
        }
        const landmarkFeatures: EditorMapLandmark[] =
          pointsSourceRef.current
            .getFeatures()
            .map((feature) => getEditorLandmarkFromPointFeature(feature as Feature<Geometry>))
            .filter((item): item is EditorMapLandmark => item !== null);
        replaceEditorPointFeatures(pointsSourceRef.current, {
          localities: items,
          landmarks: landmarkFeatures,
        });
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

        if (cancelled || !pointsSourceRef.current) {
          return;
        }
        const localityFeatures: EditorMapLocality[] =
          pointsSourceRef.current
            .getFeatures()
            .map((feature) => getEditorLocalityFromPointFeature(feature as Feature<Geometry>))
            .filter((item): item is EditorMapLocality => item !== null);
        replaceEditorPointFeatures(pointsSourceRef.current, {
          localities: localityFeatures,
          landmarks: items,
        });
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
    void loadRoutes();
    void loadLocalities();
    void loadLandmarks();
    void loadReferenceData();

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      unByKey(translateStartKey);
      unByKey(translateEndKey);
      unByKey(routeVertexTranslateStartKey);
      unByKey(routeVertexTranslateEndKey);
      unByKey(singleClickKey);
      unByKey(pointerMoveKey);
      map.removeInteraction(translateInteraction);
      map.removeInteraction(routeVertexTranslateInteraction);
      map.getTargetElement().style.cursor = "";
      map.setTarget(undefined);
      casesSourceRef.current = null;
      casesLayerRef.current = null;
      routesSourceRef.current = null;
      routesLayerRef.current = null;
      routePreviewSourceRef.current = null;
      routePreviewLayerRef.current = null;
      routeVerticesSourceRef.current = null;
      routeVerticesLayerRef.current = null;
      pointsSourceRef.current = null;
      pointsLayerRef.current = null;
      localityTranslateInteractionRef.current = null;
      routeVertexTranslateInteractionRef.current = null;
      mapRef.current = null;
    };
  }, [
    handleCloseLocalitySelection,
    handleCloseRouteSelection,
    handleLocalityTranslateEnd,
    handleRouteVertexTranslateEnd,
    selectLandmark,
    selectLocality,
    selectRoute,
  ]);

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
          icon_key: pointDraft.icon_key,
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

        if (pointsSourceRef.current) {
          upsertEditorPointFeature(pointsSourceRef.current, {
            family: "locality",
            locality: created,
          });
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

        if (pointsSourceRef.current) {
          upsertEditorPointFeature(pointsSourceRef.current, {
            family: "landmark",
            landmark: created,
          });
        }

        setLandmarksCount((count) => (count === null ? 1 : count + 1));
        selectLandmark(created);
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
        icon_key: localityEditDraft.icon_key,
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

      if (pointsSourceRef.current) {
        upsertEditorPointFeature(pointsSourceRef.current, {
          family: "locality",
          locality: updated,
        });
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

  async function handleSaveLandmarkEdit() {
    if (!selectedLandmark || !landmarkEditDraft) {
      return;
    }

    const name = landmarkEditDraft.name.trim();
    const typeKey = landmarkEditDraft.type_key.trim();
    const typeCategory =
      referenceData?.landmark_types.find((option) => option.value === typeKey)?.category ?? null;

    if (!name || !typeKey) {
      setLocalityEditError("Le nom et le type sont obligatoires.");
      return;
    }

    if (
      typeCategory === "unique" &&
      (referenceData?.map_icons.length ?? 0) > 0 &&
      !landmarkEditDraft.icon_key
    ) {
      setLocalityEditError("L'icone est obligatoire pour un lieu unique.");
      return;
    }

    setLocalityEditSaving(true);
    setLocalityEditError(null);

    try {
      const patch: EditorMapLandmarkPatch = {
        name,
        type_key: typeKey,
        icon_key: typeCategory === "unique" ? landmarkEditDraft.icon_key : null,
        status: landmarkEditDraft.status,
        description:
          landmarkEditDraft.description.trim().length > 0
            ? landmarkEditDraft.description.trim()
            : null,
      };

      const updated = await fetchJson<EditorMapLandmark>(
        `/api/admin/editor/landmarks/${encodeURIComponent(selectedLandmark.id_landmark)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );

      if (pointsSourceRef.current) {
        upsertEditorPointFeature(pointsSourceRef.current, {
          family: "landmark",
          landmark: updated,
        });
      }

      const nextDraft = createLandmarkEditDraft(updated);

      setSelectedLandmark(updated);
      setLandmarkEditDraft(nextDraft);
      setLandmarkEditSnapshot(getLandmarkEditSnapshot(nextDraft));
    } catch (error) {
      setLocalityEditError(
        error instanceof Error ? error.message : "Mise a jour de landmark impossible.",
      );
    } finally {
      setLocalityEditSaving(false);
    }
  }

  function handlePopLastRoutePoint() {
    setRouteDraft((draft) =>
      draft ? { ...draft, points: draft.points.slice(0, -1) } : draft,
    );
    setRouteSaveError(null);
  }

  function handleClearRouteTrace() {
    setRouteDraft((draft) => (draft ? { ...draft, points: [] } : draft));
    setRouteSaveError(null);
  }

  async function handleSaveRouteCreate() {
    if (!routeDraft) {
      return;
    }

    const name = routeDraft.name.trim();
    const routeType = routeDraft.route_type.trim();

    if (!name || !routeType) {
      setRouteSaveError("Le nom et le type technique sont obligatoires.");
      return;
    }

    if (routeDraft.points.length < 2) {
      setRouteSaveError("Deux points minimum sont requis.");
      return;
    }

    if (!routeColorValid) {
      setRouteSaveError("La couleur de trait est invalide.");
      return;
    }

    setRouteSaving(true);
    setRouteSaveError(null);

    try {
      const payload: EditorMapRouteInput = {
        name,
        route_type: routeType,
        points: routeDraft.points,
        geometry_mode: routeDraft.geometry_mode,
        stroke_style: routeDraft.stroke_style,
        stroke_width: routeDraft.stroke_width,
        stroke_color: routeDraft.stroke_color.trim() || null,
        faction: null,
        controleur: null,
        status: "draft",
        description: routeDraft.description.trim() || null,
      };

      const created = await fetchJson<EditorMapRoute>("/api/admin/editor/routes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (routesSourceRef.current) {
        upsertEditorRouteFeature(routesSourceRef.current, created);
      }

      setRoutesCount((count) => (count === null ? 1 : count + 1));
      setRouteDraft(null);
      setEditorTool("select");
      if (routePreviewSourceRef.current) {
        clearEditorRoutePreview(routePreviewSourceRef.current);
      }
    } catch (error) {
      setRouteSaveError(error instanceof Error ? error.message : "Creation de route impossible.");
    } finally {
      setRouteSaving(false);
    }
  }

  async function handleSaveRouteEdit() {
    if (!selectedRoute || !routeEditDraft) {
      return;
    }

    const name = routeEditDraft.name.trim();
    const routeType = routeEditDraft.route_type.trim();

    if (!name || !routeType) {
      setRouteEditError("Le nom et le type technique sont obligatoires.");
      return;
    }

    if (!routeEditColorValid) {
      setRouteEditError("La couleur de trait est invalide.");
      return;
    }

    if (routeEditDraft.stroke_width < 1 || routeEditDraft.stroke_width > 12) {
      setRouteEditError("L'epaisseur doit etre comprise entre 1 et 12.");
      return;
    }

    setRouteEditSaving(true);
    setRouteEditError(null);

    try {
      const patch: EditorMapRoutePatch = {
        name,
        route_type: routeType,
        geometry_mode: routeEditDraft.geometry_mode,
        stroke_style: routeEditDraft.stroke_style,
        stroke_width: routeEditDraft.stroke_width,
        stroke_color: routeEditDraft.stroke_color.trim() || null,
        status: routeEditDraft.status,
        description: routeEditDraft.description.trim() || null,
      };

      const updated = await fetchJson<EditorMapRoute>(
        `/api/admin/editor/routes/${encodeURIComponent(selectedRoute.id_route)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );

      if (routesSourceRef.current) {
        upsertEditorRouteFeature(routesSourceRef.current, updated);
      }

      const nextDraft = createRouteEditDraft(updated);

      setSelectedRoute(updated);
      setRouteEditDraft(nextDraft);
      setRouteEditSnapshot(getRouteEditSnapshot(nextDraft));
    } catch (error) {
      setRouteEditError(error instanceof Error ? error.message : "Mise a jour de route impossible.");
    } finally {
      setRouteEditSaving(false);
    }
  }

  function handleDeleteSelectedRouteVertex() {
    if (!routeGeometryDraft || selectedRouteVertexIndex === null || routeGeometryDraft.points.length <= 2) {
      return;
    }

    const nextPoints = routeGeometryDraft.points.filter(
      (_, index) => index !== selectedRouteVertexIndex,
    );
    const nextSelectedIndex =
      nextPoints.length === 0
        ? null
        : Math.min(selectedRouteVertexIndex, nextPoints.length - 1);

    setRouteGeometryDraft({
      ...routeGeometryDraft,
      points: nextPoints,
    });
    setSelectedRouteVertexIndex(nextSelectedIndex);
    setRouteGeometryTool("select-vertex");
    setRouteGeometryError(null);
  }

  async function handleSaveRouteGeometry() {
    if (!selectedRoute || !routeGeometryDraft) {
      return;
    }

    if (routeGeometryDraft.points.length < 2) {
      setRouteGeometryError("Deux points minimum sont requis.");
      return;
    }

    if (
      routeGeometryDraft.points.some(
        (point) =>
          !Array.isArray(point) ||
          point.length < 2 ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]),
      )
    ) {
      setRouteGeometryError("La geometrie de route est invalide.");
      return;
    }

    setRouteGeometrySaving(true);
    setRouteGeometryError(null);

    try {
      const updated = await fetchJson<EditorMapRoute>(
        `/api/admin/editor/routes/${encodeURIComponent(selectedRoute.id_route)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            points: routeGeometryDraft.points,
          } satisfies Pick<EditorMapRoutePatch, "points">),
        },
      );

      if (routesSourceRef.current) {
        upsertEditorRouteFeature(routesSourceRef.current, updated);
      }

      const geometryDraft = createRouteGeometryDraft(updated);
      const geometrySnapshot = getRouteGeometrySnapshot(geometryDraft.points);
      const routeDraftIsDirty =
        routeEditDraft && routeEditSnapshot
          ? getRouteEditSnapshot(routeEditDraft) !== routeEditSnapshot
          : false;

      setSelectedRoute(updated);
      if (!routeDraftIsDirty) {
        const nextDraft = createRouteEditDraft(updated);
        setRouteEditDraft(nextDraft);
        setRouteEditSnapshot(getRouteEditSnapshot(nextDraft));
      }
      setRouteGeometryDraft(geometryDraft);
      setRouteGeometrySnapshot(geometrySnapshot);
      setSelectedRouteVertexIndex(null);
      setRouteGeometryTool("select-vertex");
    } catch (error) {
      setRouteGeometryError(
        error instanceof Error ? error.message : "Mise a jour de geometrie impossible.",
      );
    } finally {
      setRouteGeometrySaving(false);
    }
  }

  const selectedLandmarkTypeOption =
    selectedLandmark && landmarkEditDraft
      ? referenceData?.landmark_types.find((option) => option.value === landmarkEditDraft.type_key) ??
        null
      : null;
  const selectedLandmarkCategory = selectedLandmarkTypeOption?.category ?? null;

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
              if (handleToolChangeBlockedByRouteGeometry()) {
                return;
              }
              handleCloseLocalitySelection();
              handleCloseRouteSelection();
              setRouteDraft(null);
              setRouteSaveError(null);
              if (routePreviewSourceRef.current) {
                clearEditorRoutePreview(routePreviewSourceRef.current);
              }
              setEditorTool((tool) => (tool === "create-point" ? "select" : "create-point"));
              setPointDraft(null);
              setLocalitySaveError(null);
            }}
          >
            {editorTool === "create-point" ? "Annuler la creation" : "Creer un point"}
          </Button>
          <Button
            type="button"
            variant={editorTool === "create-route" ? "secondary" : "outline"}
            className="mt-2"
            onClick={() => {
              if (handleToolChangeBlockedByRouteGeometry()) {
                return;
              }
              handleCloseLocalitySelection();
              handleCloseRouteSelection();
              setPointDraft(null);
              setLocalitySaveError(null);
              setEditorTool((tool) => {
                if (tool === "create-route") {
                  setRouteDraft(null);
                  setRouteSaveError(null);
                  if (routePreviewSourceRef.current) {
                    clearEditorRoutePreview(routePreviewSourceRef.current);
                  }
                  return "select";
                }

                setRouteDraft(createEmptyRouteDraft());
                setRouteSaveError(null);
                return "create-route";
              });
            }}
          >
            {editorTool === "create-route" ? "Annuler la route" : "Creer une route"}
          </Button>
          <Button
            type="button"
            variant={routesVisible ? "secondary" : "outline"}
            className="mt-2"
            onClick={() =>
              setRoutesVisible((visible) => {
                if (visible) {
                  setHoverInfo(null);
                }

                return !visible;
              })
            }
          >
            {routesVisible ? "Masquer les routes" : "Afficher les routes"}
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
            {routesLoading
              ? "Chargement des routes..."
              : routesCount !== null
                ? `${routesCount} routes chargees`
                : "Routes non chargees"}
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
          {editorTool === "create-route" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Cliquez sur la carte pour ajouter des points. Deux points minimum.
            </p>
          ) : null}
          {routeGeometryDraft ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Edition geometrique active :{" "}
              {routeGeometryTool === "append-vertex"
                ? "ajout en fin"
                : routeGeometryTool === "insert-vertex"
                  ? "insertion apres le sommet selectionne"
                  : "selection et deplacement des sommets"}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedCaseId
              ? `Case selectionnee : ${selectedCaseId}`
              : "Aucune case selectionnee"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedRoute ? `Route selectionnee : ${selectedRoute.name}` : "Aucune route selectionnee"}
          </p>
          {localityEditDirty || landmarkEditDirty ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Enregistrez ou annulez les modifications avant de deplacer le point.
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
          {routeGeometryDragging ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Deplacement de sommet en cours...
            </p>
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
          {routesError ? <p className="mt-2 text-xs text-destructive">{routesError}</p> : null}
          {localitiesError ? (
            <p className="mt-2 text-xs text-destructive">{localitiesError}</p>
          ) : null}
          {landmarksError ? (
            <p className="mt-2 text-xs text-destructive">{landmarksError}</p>
          ) : null}
          {referenceError ? (
            <p className="mt-2 text-xs text-destructive">{referenceError}</p>
          ) : null}
          {routeDraft ? (
            <form
              className="mt-4 space-y-3 border-t border-border/70 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveRouteCreate();
              }}
            >
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Nom</span>
                <input
                  value={routeDraft.name}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft ? { ...draft, name: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Type technique</span>
                <input
                  value={routeDraft.route_type}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft ? { ...draft, route_type: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Geometrie</span>
                <select
                  value={routeDraft.geometry_mode}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            geometry_mode: event.target.value as RouteCreateDraft["geometry_mode"],
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="curved">Courbe</option>
                  <option value="straight">Droite</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Style</span>
                <select
                  value={routeDraft.stroke_style}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            stroke_style: event.target.value as RouteCreateDraft["stroke_style"],
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="solid">Plein</option>
                  <option value="dashed">Tirets</option>
                  <option value="dotted">Points</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Epaisseur</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={routeDraft.stroke_width}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            stroke_width: Number.parseInt(event.target.value || "3", 10),
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Couleur optionnelle</span>
                <input
                  placeholder="#ffffff"
                  value={routeDraft.stroke_color}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft ? { ...draft, stroke_color: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              {!routeColorValid ? (
                <p className="text-xs text-destructive">
                  La couleur doit etre vide, `#rgb` ou `#rrggbb`.
                </p>
              ) : null}
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Description</span>
                <textarea
                  value={routeDraft.description}
                  onChange={(event) =>
                    setRouteDraft((draft) =>
                      draft ? { ...draft, description: event.target.value } : draft,
                    )
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {routeDraft.points.length} point{routeDraft.points.length > 1 ? "s" : ""}
              </p>
              {routeSaveError ? (
                <p className="text-xs text-destructive">{routeSaveError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={
                    routeSaving ||
                    routeDraft.name.trim().length === 0 ||
                    routeDraft.route_type.trim().length === 0 ||
                    routeDraft.points.length < 2 ||
                    !routeColorValid
                  }
                >
                  {routeSaving ? "Sauvegarde..." : "Terminer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePopLastRoutePoint}
                  disabled={routeSaving || routeDraft.points.length === 0}
                >
                  Retirer le dernier point
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearRouteTrace}
                  disabled={routeSaving || routeDraft.points.length === 0}
                >
                  Vider le trace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancelRouteCreate}
                  disabled={routeSaving}
                >
                  Annuler
                </Button>
              </div>
            </form>
          ) : null}
          {selectedRoute && routeEditDraft ? (
            <form
              className="mt-4 space-y-3 border-t border-border/70 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveRouteEdit();
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Route selectionnee
              </p>
              <p className="text-sm font-semibold text-foreground">{selectedRoute.name}</p>
              <p className="text-xs text-muted-foreground">
                {(routeGeometryDraft?.points.length ?? selectedRoute.points.length)} point
                {(routeGeometryDraft?.points.length ?? selectedRoute.points.length) > 1 ? "s" : ""} de controle
              </p>
              <p className="text-xs text-muted-foreground">ID : {selectedRoute.id_route}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={routeGeometryDraft ? "secondary" : "outline"}
                  size="sm"
                  disabled={routeGeometrySaving || routeSaving}
                  onClick={() => {
                    if (routeGeometryDraft) {
                      handleCloseRouteGeometryEdit();
                      return;
                    }
                    handleEnterRouteGeometryEdit();
                  }}
                >
                  {routeGeometryDraft ? "Fermer l'edition geometrique" : "Editer la geometrie"}
                </Button>
                {routeGeometryDraft ? (
                  <>
                    <Button
                      type="button"
                      variant={routeGeometryTool === "append-vertex" ? "secondary" : "outline"}
                      size="sm"
                      disabled={routeGeometrySaving}
                      onClick={() => {
                        setRouteGeometryTool("append-vertex");
                        setRouteGeometryError(null);
                      }}
                    >
                      Ajouter un sommet a la fin
                    </Button>
                    <Button
                      type="button"
                      variant={routeGeometryTool === "insert-vertex" ? "secondary" : "outline"}
                      size="sm"
                      disabled={routeGeometrySaving || selectedRouteVertexIndex === null}
                      onClick={() => {
                        setRouteGeometryTool("insert-vertex");
                        setRouteGeometryError(null);
                      }}
                    >
                      Inserer apres ce sommet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        routeGeometrySaving ||
                        selectedRouteVertexIndex === null ||
                        routeGeometryDraft.points.length <= 2
                      }
                      onClick={handleDeleteSelectedRouteVertex}
                    >
                      Supprimer le sommet
                    </Button>
                  </>
                ) : null}
              </div>
              {routeGeometryDraft ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-background/60 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    {selectedRouteVertexIndex !== null
                      ? `Sommet selectionne : ${selectedRouteVertexIndex + 1} / ${routeGeometryDraft.points.length}`
                      : `${routeGeometryDraft.points.length} sommets visibles`}
                  </p>
                  {routeGeometryDirty ? (
                    <p className="text-xs text-muted-foreground">
                      Sauvegardez ou annulez la geometrie avant de modifier les autres champs.
                    </p>
                  ) : null}
                  {routeGeometryError ? (
                    <p className="text-xs text-destructive">{routeGeometryError}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        routeGeometrySaving ||
                        routeGeometryDraft.points.length < 2 ||
                        !routeGeometryDirty
                      }
                      onClick={() => {
                        void handleSaveRouteGeometry();
                      }}
                    >
                      {routeGeometrySaving ? "Enregistrement..." : "Enregistrer la geometrie"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={routeGeometrySaving || !routeGeometryDirty}
                      onClick={handleCancelRouteGeometryEdit}
                    >
                      Annuler les modifications geometriques
                    </Button>
                  </div>
                </div>
              ) : null}
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Nom</span>
                <input
                  value={routeEditDraft.name}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft ? { ...draft, name: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Type technique</span>
                <input
                  value={routeEditDraft.route_type}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft ? { ...draft, route_type: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Geometrie</span>
                <select
                  value={routeEditDraft.geometry_mode}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            geometry_mode: event.target.value as RouteEditDraft["geometry_mode"],
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="curved">Courbe</option>
                  <option value="straight">Droite</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Style</span>
                <select
                  value={routeEditDraft.stroke_style}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            stroke_style: event.target.value as RouteEditDraft["stroke_style"],
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="solid">Plein</option>
                  <option value="dashed">Tirets</option>
                  <option value="dotted">Points</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Epaisseur</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={routeEditDraft.stroke_width}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            stroke_width: Number.parseInt(event.target.value || "3", 10),
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Couleur</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    value={normalizeColorInput(routeEditDraft.stroke_color)}
                    onChange={(event) =>
                      setRouteEditDraft((draft) =>
                        draft ? { ...draft, stroke_color: event.target.value } : draft,
                      )
                    }
                    className="h-10 w-14 rounded-xl border border-border/80 bg-background/70 px-1"
                  />
                  <input
                    value={routeEditDraft.stroke_color}
                    placeholder="#ffffff"
                    onChange={(event) =>
                      setRouteEditDraft((draft) =>
                        draft ? { ...draft, stroke_color: event.target.value } : draft,
                      )
                    }
                    className="h-10 min-w-28 flex-1 rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setRouteEditDraft((draft) =>
                        draft ? { ...draft, stroke_color: "" } : draft,
                      )
                    }
                  >
                    Couleur par defaut
                  </Button>
                </div>
              </label>
              {!routeEditColorValid ? (
                <p className="text-xs text-destructive">
                  La couleur doit etre vide, `#rgb` ou `#rrggbb`.
                </p>
              ) : null}
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Statut</span>
                <select
                  value={routeEditDraft.status}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            status: event.target.value as RouteEditDraft["status"],
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
                  value={routeEditDraft.description}
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft ? { ...draft, description: event.target.value } : draft,
                    )
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
              <div className="sticky bottom-0 -mx-4 mt-4 space-y-2 border-t border-border/70 bg-background/95 px-4 py-3">
                {routeEditError ? (
                  <p className="text-xs text-destructive">{routeEditError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      routeEditSaving ||
                      routeGeometryDirty ||
                      routeGeometrySaving ||
                      routeEditDraft.name.trim().length === 0 ||
                      routeEditDraft.route_type.trim().length === 0 ||
                      routeEditDraft.stroke_width < 1 ||
                      routeEditDraft.stroke_width > 12 ||
                      !routeEditColorValid ||
                      !routeEditDirty
                    }
                  >
                    {routeEditSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={routeEditSaving || !routeEditDirty}
                    onClick={handleCancelRouteEdit}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={routeEditSaving}
                    onClick={handleCloseRouteSelection}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </form>
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
              {pointDraft.family === "locality" ? (
                <label className="block text-xs text-muted-foreground">
                  <span className="mb-1 block">Icone</span>
                  <select
                    value={pointDraft.icon_key ?? ""}
                    onChange={(event) =>
                      setPointDraft((draft) =>
                        draft
                          ? {
                              ...draft,
                              icon_key:
                                event.target.value.trim().length > 0 ? event.target.value : null,
                            }
                          : draft,
                      )
                    }
                    className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                  >
                    <option value="">Icone du type</option>
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
                <span className="mb-1 block">Icone</span>
                <select
                  value={localityEditDraft.icon_key ?? ""}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            icon_key:
                              event.target.value.trim().length > 0 ? event.target.value : null,
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="">Icone du type</option>
                  {(referenceData?.map_icons ?? []).map((option) => (
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
          {selectedLandmark && landmarkEditDraft ? (
            <form
              className="mt-4 space-y-3 border-t border-border/70 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveLandmarkEdit();
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Landmark selectionne
              </p>
              <p className="text-sm font-semibold text-foreground">{selectedLandmark.name}</p>
              <p className="text-xs text-muted-foreground">
                Position : {Math.round(selectedLandmark.x)}, {Math.round(selectedLandmark.y)}
              </p>
              <p className="text-xs text-muted-foreground">
                Case : {selectedLandmark.id_case_detected ?? "non detectee"}
              </p>
              <p className="text-xs text-muted-foreground">
                ID : {selectedLandmark.id_landmark}
              </p>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Nom</span>
                <input
                  value={landmarkEditDraft.name}
                  onChange={(event) =>
                    setLandmarkEditDraft((draft) =>
                      draft ? { ...draft, name: event.target.value } : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Type</span>
                <select
                  value={landmarkEditDraft.type_key}
                  onChange={(event) =>
                    setLandmarkEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            type_key: event.target.value,
                            icon_key:
                              referenceData?.landmark_types.find(
                                (option) => option.value === event.target.value,
                              )?.category === "unique"
                                ? draft.icon_key
                                : null,
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  {referenceData?.landmark_types.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedLandmarkCategory === "unique" ? (
                <label className="block text-xs text-muted-foreground">
                  <span className="mb-1 block">Icone</span>
                  <select
                    value={landmarkEditDraft.icon_key ?? ""}
                    onChange={(event) =>
                      setLandmarkEditDraft((draft) =>
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
                <span className="mb-1 block">Statut</span>
                <select
                  value={landmarkEditDraft.status}
                  onChange={(event) =>
                    setLandmarkEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            status: event.target.value as LandmarkEditDraft["status"],
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
                  value={landmarkEditDraft.description}
                  onChange={(event) =>
                    setLandmarkEditDraft((draft) =>
                      draft ? { ...draft, description: event.target.value } : draft,
                    )
                  }
                  className="min-h-24 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
              {selectedLandmarkCategory === "unique" && (referenceData?.map_icons.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune icone active n&apos;est disponible. Le lieu unique gardera le fallback visuel.
                </p>
              ) : null}
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
                      landmarkEditDraft.name.trim().length === 0 ||
                      landmarkEditDraft.type_key.trim().length === 0 ||
                      !landmarkEditDirty
                    }
                  >
                    {localityEditSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={localityEditSaving || !landmarkEditDirty}
                    onClick={handleCancelLandmarkEdit}
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
      {hoverInfo && (casesVisible || routesVisible || localitiesVisible || landmarksVisible) ? (
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
