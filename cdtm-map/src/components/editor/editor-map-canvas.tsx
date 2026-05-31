"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Collection from "ol/Collection";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import type Geometry from "ol/geom/Geometry";
import type Map from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";
import Translate from "ol/interaction/Translate";
import { ChevronDown } from "lucide-react";

import {
  createEmptyAdminBulkEditDraft,
  type AdminBulkEditDraft,
  type AdminBulkUpdateResult,
  type AdminCaseDraft,
  type AdminCaseRecord,
  type PublicCaseIndexResponse,
  type PublicCaseProperties,
} from "@/admin/types";
import {
  applyPersistedRecordToStableCase,
  buildBulkEditDraft,
  buildBulkPatch,
  createEmptySingleAdminDraft,
  createSingleAdminDraft,
  getDraftSnapshot,
  hasBulkDraftChanges,
  mergePersistedRecordsIntoStableCases,
  updateBulkAdminDraftField,
  updateBulkBonusContextuelsDraft,
  updateSingleAdminDraftField,
  updateSingleBonusContextuelsDraft,
  updateSingleDynamicAdminDraftField,
} from "@/admin/case-editing";
import { CaseAdminEditor } from "@/components/admin/case-admin-editor";
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
  EditorReferenceOption,
} from "@/editor/types";
import {
  buildCasePropertiesById,
  getStableCasesFromCollection,
  getRegistryCaseId,
  mergeStableCases,
} from "@/map/case-data";
import { buildCaseHoverRows } from "@/map/case-hover";
import { MAP_MAX_ZOOM } from "@/map/config";
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
  preloadCdtmBackgroundImage,
} from "@/map/openlayers/map-core";
import {
  CASES_DATA_URL,
  createEmptyPublicMapStyles,
  isStableCaseFeatureCollection,
  normalizeMapDisplayMode,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
} from "@/map/types";
import { getNormalizedSvgIconSource } from "@/map/openlayers/svg-icon-source";
import {
  buildCaseSearchTargets,
  buildEditorObjectSearchTargets,
  resolveMapSearchTarget,
} from "@/map/search";

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
  depends_on_locality_id: string | null;
  force_slot_override: boolean;
  slot_override_reason: string;
};

type LocalityEditDraft = {
  id_locality: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  status: "draft" | "published" | "archived";
  depends_on_locality_id: string | null;
  force_slot_override: boolean;
  slot_override_reason: string;
  description: string;
};

type LandmarkEditDraft = {
  id_landmark: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  status: "draft" | "published" | "archived";
  force_slot_override: boolean;
  slot_override_reason: string;
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

type RouteGeometryTool =
  | "select-vertex"
  | "prepend-vertex"
  | "append-vertex"
  | "insert-before-vertex"
  | "insert-after-vertex";

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

type EditorMapCanvasProps = {
  canEditMapObjects: boolean;
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

function readInitialCaseSelection(availableCaseIds: Set<string>): {
  activeCaseId: string | null;
  selectedCaseIds: string[];
} {
  if (typeof window === "undefined") {
    return { activeCaseId: null, selectedCaseIds: [] };
  }

  const params = new URLSearchParams(window.location.search);
  const caseParam = params.get("case")?.trim() ?? "";
  const caseListParam = params.get("cases")?.trim() ?? "";
  const requestedIds = [
    ...caseListParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    caseParam,
  ].filter(Boolean);
  const selectedCaseIds = Array.from(new Set(requestedIds)).filter((idCase) =>
    availableCaseIds.has(idCase),
  );
  const activeCaseId =
    caseParam && availableCaseIds.has(caseParam)
      ? caseParam
      : (selectedCaseIds.at(-1) ?? null);

  return { activeCaseId, selectedCaseIds };
}

function createLocalityEditDraft(
  locality: EditorMapLocality,
): LocalityEditDraft {
  return {
    id_locality: locality.id_locality,
    name: locality.name,
    type_key: locality.type_key,
    icon_key: locality.icon_key,
    status: locality.status,
    depends_on_locality_id: locality.depends_on_locality_id,
    force_slot_override: false,
    slot_override_reason: "",
    description: locality.description ?? "",
  };
}

function createLandmarkEditDraft(
  landmark: EditorMapLandmark,
): LandmarkEditDraft {
  return {
    id_landmark: landmark.id_landmark,
    name: landmark.name,
    type_key: landmark.type_key,
    icon_key: landmark.icon_key,
    status: landmark.status,
    force_slot_override: false,
    slot_override_reason: "",
    description: landmark.description ?? "",
  };
}

function getReferenceOption(
  options: readonly EditorReferenceOption[] | undefined,
  value: string,
): EditorReferenceOption | null {
  return options?.find((option) => option.value === value) ?? null;
}

function formatSlotRequirement(
  option: EditorReferenceOption | null,
): string | null {
  if (!option?.consumes_slot) {
    return null;
  }

  const requiredSlots = Math.max(0, Math.trunc(option.emp_requis ?? 0));
  return `${requiredSlots} emplacement${requiredSlots > 1 ? "s" : ""} requis`;
}

function getLocalityUpgradeDependencyOptions({
  referenceData,
  localities,
  typeKey,
  idCase,
  excludedLocalityId,
}: {
  referenceData: EditorReferenceData | null;
  localities: readonly EditorMapLocality[];
  typeKey: string;
  idCase: string | null;
  excludedLocalityId?: string | null;
}): EditorMapLocality[] {
  const localityType = getReferenceOption(
    referenceData?.locality_types,
    typeKey,
  );
  const upgradedTypeKey = localityType?.upgrades_from_type_id ?? null;

  if (!upgradedTypeKey || !idCase) {
    return [];
  }

  return localities
    .filter((locality) => locality.id_locality !== excludedLocalityId)
    .filter((locality) => locality.id_case_detected === idCase)
    .filter((locality) => locality.status !== "archived")
    .filter((locality) => locality.type_key === upgradedTypeKey)
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

function getRouteGeometryLabel(
  geometryMode: EditorMapRoute["geometry_mode"],
): string {
  return geometryMode === "straight" ? "Droite" : "Courbe";
}

function getRouteStrokeStyleLabel(
  strokeStyle: EditorMapRoute["stroke_style"],
): string {
  if (strokeStyle === "dashed") {
    return "Tirets";
  }

  if (strokeStyle === "dotted") {
    return "Points";
  }

  return "Plein";
}

function getDefaultPointFamily(
  referenceData: EditorReferenceData | null,
): EditorCreateObjectFamily {
  if ((referenceData?.locality_types.length ?? 0) > 0) {
    return "locality";
  }

  if (
    (referenceData?.landmark_types.filter(
      (option) => option.category !== "unique",
    ).length ?? 0) > 0
  ) {
    return "landmark";
  }

  return "unique";
}

function getFirstLandmarkTypeKey(
  referenceData: EditorReferenceData | null,
): string {
  return (
    referenceData?.landmark_types.find((option) => option.category !== "unique")
      ?.value ?? ""
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
      depends_on_locality_id: null,
      force_slot_override: false,
      slot_override_reason: "",
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
    depends_on_locality_id: null,
    force_slot_override: false,
    slot_override_reason: "",
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
    force_slot_override: draft.force_slot_override,
    slot_override_reason: draft.slot_override_reason,
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

function createRouteGeometryDraft(
  route: EditorMapRoute,
): RouteGeometryEditDraft {
  return {
    id_route: route.id_route,
    points: route.points.map(([x, y]) => [x, y]),
  };
}

function getRouteGeometrySnapshot(points: Array<[number, number]>): string {
  return JSON.stringify(points);
}

function getFirstTranslatedFeature(
  rawEvent: unknown,
): Feature<Geometry> | null {
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

export function EditorMapCanvas({ canEditMapObjects }: EditorMapCanvasProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const casesSourceRef = useRef<ReturnType<
    typeof createCasesVectorSource
  > | null>(null);
  const casesLayerRef = useRef<ReturnType<
    typeof createCasesVectorLayer
  > | null>(null);
  const routesSourceRef = useRef<ReturnType<
    typeof createEditorRoutesVectorSource
  > | null>(null);
  const routesLayerRef = useRef<ReturnType<
    typeof createEditorRoutesVectorLayer
  > | null>(null);
  const routePreviewSourceRef = useRef<ReturnType<
    typeof createEditorRoutePreviewVectorSource
  > | null>(null);
  const routePreviewLayerRef = useRef<ReturnType<
    typeof createEditorRoutePreviewVectorLayer
  > | null>(null);
  const routeVerticesSourceRef = useRef<ReturnType<
    typeof createEditorRouteVerticesVectorSource
  > | null>(null);
  const routeVerticesLayerRef = useRef<ReturnType<
    typeof createEditorRouteVerticesVectorLayer
  > | null>(null);
  const pointsSourceRef = useRef<ReturnType<
    typeof createEditorPointsVectorSource
  > | null>(null);
  const pointsLayerRef = useRef<ReturnType<
    typeof createEditorPointsVectorLayer
  > | null>(null);
  const casesVisibleRef = useRef(true);
  const routesVisibleRef = useRef(true);
  const localitiesVisibleRef = useRef(true);
  const landmarksVisibleRef = useRef(true);
  const localityDisplayModeRef = useRef<LocalityDisplayMode>("icons");
  const mapDisplayModeRef = useRef<MapDisplayMode>("influence");
  const activeCaseIdRef = useRef<string | null>(null);
  const selectedCaseIdsRef = useRef<Set<string>>(new Set());
  const caseAdminDirtyRef = useRef(false);
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
  const localityEditDraftRef = useRef<LocalityEditDraft | null>(null);
  const landmarkEditDraftRef = useRef<LandmarkEditDraft | null>(null);
  const localityTranslateInteractionRef = useRef<Translate | null>(null);
  const routeVertexTranslateInteractionRef = useRef<Translate | null>(null);
  const localityDragOriginRef = useRef<DragOrigin | null>(null);
  const referenceDataRef = useRef<EditorReferenceData | null>(null);
  const mapIconImagePathByKeyRef = useRef<Record<string, string>>({});
  const mapIconSourceByKeyRef = useRef<Record<string, string>>({});
  const localityDefaultIconKeyByTypeRef = useRef<Record<string, string>>({});
  const landmarkDefaultIconKeyByTypeRef = useRef<Record<string, string>>({});
  const landmarkCategoryByTypeRef = useRef<
    Record<string, "landmark" | "unique">
  >({});
  const casePropertiesByIdRef = useRef<Record<string, StableCaseProperties>>(
    {},
  );
  const publicMapStylesRef = useRef<PublicMapStyles>(
    createEmptyPublicMapStyles(),
  );
  const [stableCases, setStableCases] = useState<StableCaseProperties[]>([]);
  const [casesVisible, setCasesVisible] = useState(true);
  const [, setCasesCount] = useState<number | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [, setCasesLoading] = useState(false);
  const [routesVisible, setRoutesVisible] = useState(true);
  const [routes, setRoutes] = useState<EditorMapRoute[]>([]);
  const [, setRoutesCount] = useState<number | null>(null);
  const [, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [localitiesVisible, setLocalitiesVisible] = useState(true);
  const [localities, setLocalities] = useState<EditorMapLocality[]>([]);
  const [, setLocalitiesCount] = useState<number | null>(null);
  const [, setLocalitiesLoading] = useState(false);
  const [localitiesError, setLocalitiesError] = useState<string | null>(null);
  const [landmarksVisible, setLandmarksVisible] = useState(true);
  const [landmarks, setLandmarks] = useState<EditorMapLandmark[]>([]);
  const [, setLandmarksCount] = useState<number | null>(null);
  const [, setLandmarksLoading] = useState(false);
  const [landmarksError, setLandmarksError] = useState<string | null>(null);
  const [referenceData, setReferenceData] =
    useState<EditorReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [localityDisplayMode, setLocalityDisplayMode] =
    useState<LocalityDisplayMode>("icons");
  const [mapDisplayMode, setMapDisplayMode] =
    useState<MapDisplayMode>("influence");
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedLocality, setSelectedLocality] =
    useState<EditorMapLocality | null>(null);
  const [selectedLandmark, setSelectedLandmark] =
    useState<EditorMapLandmark | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<EditorMapRoute | null>(
    null,
  );
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [pointDraft, setPointDraft] = useState<MapObjectCreateDraft | null>(
    null,
  );
  const [routeDraft, setRouteDraft] = useState<RouteCreateDraft | null>(null);
  const [localitySaving, setLocalitySaving] = useState(false);
  const [localitySaveError, setLocalitySaveError] = useState<string | null>(
    null,
  );
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeSaveError, setRouteSaveError] = useState<string | null>(null);
  const [routeEditDraft, setRouteEditDraft] = useState<RouteEditDraft | null>(
    null,
  );
  const [routeEditSnapshot, setRouteEditSnapshot] = useState<string | null>(
    null,
  );
  const [routeEditSaving, setRouteEditSaving] = useState(false);
  const [routeEditError, setRouteEditError] = useState<string | null>(null);
  const [routeGeometryDraft, setRouteGeometryDraft] =
    useState<RouteGeometryEditDraft | null>(null);
  const [routeGeometrySnapshot, setRouteGeometrySnapshot] = useState<
    string | null
  >(null);
  const [selectedRouteVertexIndex, setSelectedRouteVertexIndex] = useState<
    number | null
  >(null);
  const [routeGeometrySaving, setRouteGeometrySaving] = useState(false);
  const [routeGeometryError, setRouteGeometryError] = useState<string | null>(
    null,
  );
  const [routeGeometryDragging, setRouteGeometryDragging] = useState(false);
  const [routeGeometryTool, setRouteGeometryTool] =
    useState<RouteGeometryTool>("select-vertex");
  const [localityEditDraft, setLocalityEditDraft] =
    useState<LocalityEditDraft | null>(null);
  const [localityEditSnapshot, setLocalityEditSnapshot] = useState<
    string | null
  >(null);
  const [landmarkEditDraft, setLandmarkEditDraft] =
    useState<LandmarkEditDraft | null>(null);
  const [landmarkEditSnapshot, setLandmarkEditSnapshot] = useState<
    string | null
  >(null);
  const [localityEditSaving, setLocalityEditSaving] = useState(false);
  const [localityEditError, setLocalityEditError] = useState<string | null>(
    null,
  );
  const [localityDragging, setLocalityDragging] = useState(false);
  const [localityMoveSaving, setLocalityMoveSaving] = useState(false);
  const [localityMoveError, setLocalityMoveError] = useState<string | null>(
    null,
  );
  const [adminRecordsById, setAdminRecordsById] = useState<
    Record<string, AdminCaseRecord>
  >({});
  const [singleDraft, setSingleDraft] = useState<AdminCaseDraft>(
    createEmptySingleAdminDraft(),
  );
  const [singleSnapshot, setSingleSnapshot] = useState(
    getDraftSnapshot(createEmptySingleAdminDraft()),
  );
  const [bulkDraft, setBulkDraft] = useState<AdminBulkEditDraft>(
    createEmptyAdminBulkEditDraft(),
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

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
      ? getRouteGeometrySnapshot(routeGeometryDraft.points) !==
        routeGeometrySnapshot
      : false;
  const routeColorValid = routeDraft
    ? isValidRouteColor(routeDraft.stroke_color)
    : true;
  const routeEditColorValid = routeEditDraft
    ? isValidRouteColor(routeEditDraft.stroke_color)
    : true;
  const stableCasesById = useMemo(
    () =>
      new globalThis.Map(
        stableCases.map((item) => [getRegistryCaseId(item), item]),
      ),
    [stableCases],
  );
  const searchOptions = useMemo(
    () => [
      ...buildCaseSearchTargets(stableCases),
      ...buildEditorObjectSearchTargets({
        localities,
        landmarks,
        routes,
      }),
    ],
    [landmarks, localities, routes, stableCases],
  );
  const activeCase = useMemo(
    () => (activeCaseId ? (stableCasesById.get(activeCaseId) ?? null) : null),
    [activeCaseId, stableCasesById],
  );
  const selectedAdminRecords = useMemo(
    () =>
      selectedCaseIds
        .map((idCase) => adminRecordsById[idCase])
        .filter((record): record is AdminCaseRecord => Boolean(record)),
    [adminRecordsById, selectedCaseIds],
  );
  const selectedCaseIdsKey = selectedCaseIds.join("\u0000");
  const activeAdminRecord = activeCaseId
    ? (adminRecordsById[activeCaseId] ?? null)
    : null;
  const isCaseMultiSelection = selectedCaseIds.length > 1;
  const caseAdminDirty = isCaseMultiSelection
    ? hasBulkDraftChanges(bulkDraft)
    : getDraftSnapshot(singleDraft) !== singleSnapshot;

  useEffect(() => {
    caseAdminDirtyRef.current = caseAdminDirty;
  }, [caseAdminDirty]);

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
    syncEditorPointsLayerVisibility(
      pointsLayerRef.current,
      localitiesVisible || landmarksVisible,
    );

    if (!localitiesVisible) {
      mapRef.current?.getTargetElement().style.setProperty("cursor", "");
    }
    pointsLayerRef.current?.changed();
  }, [localitiesVisible, landmarksVisible]);

  useEffect(() => {
    landmarksVisibleRef.current = landmarksVisible;
    syncEditorPointsLayerVisibility(
      pointsLayerRef.current,
      localitiesVisible || landmarksVisible,
    );

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
    mapDisplayModeRef.current = normalizeMapDisplayMode(mapDisplayMode);
    casesLayerRef.current?.changed();
    mapRef.current?.getTargetElement().style.setProperty("cursor", "");

    const frame = requestAnimationFrame(() => {
      setHoverInfo(null);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [mapDisplayMode]);

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
        geometry_mode:
          routeEditDraft?.geometry_mode ?? selectedRoute.geometry_mode,
        stroke_style:
          routeEditDraft?.stroke_style ?? selectedRoute.stroke_style,
        stroke_width:
          routeEditDraft?.stroke_width ?? selectedRoute.stroke_width,
        stroke_color:
          routeEditDraft?.stroke_color ?? selectedRoute.stroke_color ?? "",
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
    localityEditDraftRef.current = localityEditDraft;
  }, [localityEditDraft]);

  useEffect(() => {
    landmarkEditDraftRef.current = landmarkEditDraft;
  }, [landmarkEditDraft]);

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
        .filter(
          (icon) =>
            typeof icon.image_path === "string" &&
            icon.image_path.trim().length > 0,
        )
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
            console.error("Icone SVG impossible a normaliser.", {
              icon: iconKey,
              imagePath,
              error,
            });
            return [iconKey, imagePath] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      mapIconSourceByKeyRef.current = Object.fromEntries(
        entries.filter(
          (entry): entry is readonly [string, string] => entry !== null,
        ),
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
    const previousActiveCaseId = activeCaseIdRef.current;
    const previousSelectedCaseIds = selectedCaseIdsRef.current;
    const nextSelectedCaseIds = new Set(selectedCaseIds);

    activeCaseIdRef.current = activeCaseId;
    selectedCaseIdsRef.current = nextSelectedCaseIds;

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

    for (const idCase of previousSelectedCaseIds) {
      changedIds.add(idCase);
    }

    for (const idCase of nextSelectedCaseIds) {
      changedIds.add(idCase);
    }

    for (const idCase of changedIds) {
      source.getFeatureById(idCase)?.changed();
    }
  }, [activeCaseId, selectedCaseIds]);

  useEffect(() => {
    const interaction = localityTranslateInteractionRef.current;

    if (!interaction) {
      return;
    }

    interaction.setActive(
      canEditMapObjects &&
        (localitiesVisible || landmarksVisible) &&
        editorTool === "select" &&
        !pointDraft &&
        !routeGeometryDraft &&
        !localityMoveSaving &&
        !localityEditDirty &&
        !landmarkEditDirty,
    );
  }, [
    canEditMapObjects,
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
      canEditMapObjects &&
        routeGeometryDraft !== null &&
        routeGeometryTool === "select-vertex" &&
        editorTool === "select" &&
        !pointDraft &&
        !routeDraft &&
        !routeGeometrySaving,
    );
  }, [
    canEditMapObjects,
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

  const resetSingleAdminEditor = useCallback(
    (
      record: AdminCaseRecord | null,
      stableCase: StableCaseProperties | null,
    ) => {
      const nextDraft = createSingleAdminDraft(record, stableCase);

      setSingleDraft(nextDraft);
      setSingleSnapshot(getDraftSnapshot(nextDraft));
    },
    [],
  );

  const resetBulkAdminEditor = useCallback((records: AdminCaseRecord[]) => {
    setBulkDraft(buildBulkEditDraft(records));
  }, []);

  const clearCaseSelection = useCallback(() => {
    setActiveCaseId(null);
    setSelectedCaseIds([]);
    setAdminError(null);
  }, []);

  const applyCaseSelectionState = useCallback(
    (nextActiveCaseId: string | null, nextSelectedCaseIds: string[]) => {
      setActiveCaseId(nextActiveCaseId);
      setSelectedCaseIds(nextSelectedCaseIds);
      setAdminError(null);
    },
    [],
  );

  const confirmDiscardCaseChanges = useCallback((message: string) => {
    if (!caseAdminDirtyRef.current) {
      return true;
    }

    return window.confirm(message);
  }, []);

  const fetchAdminRecords = useCallback(
    async (idCases: string[]): Promise<AdminCaseRecord[]> => {
      return Promise.all(
        idCases.map((idCase) =>
          fetchJson<AdminCaseRecord>(`/api/admin/cases/${idCase}`),
        ),
      );
    },
    [],
  );

  const refreshAdminRecords = useCallback(
    async (idCases: string[]) => {
      const records = await fetchAdminRecords(idCases);

      setAdminRecordsById((current) => {
        const next = { ...current };

        for (const record of records) {
          next[record.id_case] = record;
        }

        return next;
      });

      return records;
    },
    [fetchAdminRecords],
  );

  const handleCaseSelectionChange = useCallback(
    (nextCaseId: string | null, intent: "replace" | "toggle") => {
      const currentActiveCaseId = activeCaseIdRef.current;
      const currentSelectedCaseIds = Array.from(selectedCaseIdsRef.current);

      if (intent === "replace") {
        const isSameSingleSelection =
          nextCaseId !== null &&
          currentActiveCaseId === nextCaseId &&
          currentSelectedCaseIds.length === 1 &&
          currentSelectedCaseIds[0] === nextCaseId;

        if (!nextCaseId && currentSelectedCaseIds.length === 0) {
          return;
        }

        if (isSameSingleSelection) {
          return;
        }

        if (
          !confirmDiscardCaseChanges(
            "Changer de selection abandonnera le brouillon de case non enregistre. Continuer ?",
          )
        ) {
          return;
        }

        applyCaseSelectionState(nextCaseId, nextCaseId ? [nextCaseId] : []);
        return;
      }

      if (!nextCaseId) {
        return;
      }

      if (
        !confirmDiscardCaseChanges(
          "Changer de selection abandonnera le brouillon de case non enregistre. Continuer ?",
        )
      ) {
        return;
      }

      setSelectedCaseIds((current) => {
        const alreadySelected = current.includes(nextCaseId);
        const nextSelectedCaseIds = alreadySelected
          ? current.filter((idCase) => idCase !== nextCaseId)
          : [...current, nextCaseId];
        const nextActiveCaseId = alreadySelected
          ? activeCaseIdRef.current === nextCaseId
            ? (nextSelectedCaseIds.at(-1) ?? null)
            : activeCaseIdRef.current
          : nextCaseId;

        setActiveCaseId(nextActiveCaseId);
        setAdminError(null);

        return nextSelectedCaseIds;
      });
    },
    [applyCaseSelectionState, confirmDiscardCaseChanges],
  );

  const focusCaseById = useCallback((idCase: string, duration = 250) => {
    const source = casesSourceRef.current;
    const map = mapRef.current;

    if (!source || !map) {
      return;
    }

    const feature = source.getFeatureById(idCase);
    const geometry = feature?.getGeometry();

    if (!geometry) {
      return;
    }

    map.getView().fit(geometry.getExtent(), {
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

  const selectLocality = useCallback(
    (locality: EditorMapLocality) => {
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
      clearCaseSelection();
      setEditorTool("select");
    },
    [clearCaseSelection, handleCloseRouteSelection],
  );

  function handleCancelLandmarkEdit() {
    if (!selectedLandmark) {
      return;
    }

    const draft = createLandmarkEditDraft(selectedLandmark);

    setLandmarkEditDraft(draft);
    setLandmarkEditSnapshot(getLandmarkEditSnapshot(draft));
    setLocalityEditError(null);
  }

  const selectLandmark = useCallback(
    (landmark: EditorMapLandmark) => {
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
      clearCaseSelection();
      setEditorTool("select");
    },
    [clearCaseSelection, handleCloseRouteSelection],
  );

  function handleCancelRouteEdit() {
    if (!selectedRoute) {
      return;
    }

    const draft = createRouteEditDraft(selectedRoute);

    setRouteEditDraft(draft);
    setRouteEditSnapshot(getRouteEditSnapshot(draft));
    setRouteEditError(null);
  }

  const selectRoute = useCallback(
    (route: EditorMapRoute) => {
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
      clearCaseSelection();
      setEditorTool("select");
    },
    [
      clearCaseSelection,
      handleCloseLocalitySelection,
      handleCloseRouteGeometryEdit,
    ],
  );

  const handleSearchSubmit = useCallback(() => {
    const searchTarget = resolveMapSearchTarget(searchOptions, searchValue);

    if (!searchTarget) {
      setSearchError("Aucune case ou objet ne correspond a cette recherche.");
      return;
    }

    setSearchValue(searchTarget.value);
    setSearchError(null);

    if (searchTarget.kind === "case") {
      setCasesVisible(true);
      handleCaseSelectionChange(searchTarget.id, "replace");
      focusCaseById(searchTarget.id);
      return;
    }

    if (searchTarget.kind === "locality") {
      const locality = localities.find(
        (item) => item.id_locality === searchTarget.id,
      );

      setLocalitiesVisible(true);
      focusPoint(searchTarget.x, searchTarget.y);

      if (locality) {
        selectLocality(locality);
      }
      return;
    }

    if (searchTarget.kind === "landmark") {
      const landmark = landmarks.find(
        (item) => item.id_landmark === searchTarget.id,
      );

      setLandmarksVisible(true);
      focusPoint(searchTarget.x, searchTarget.y);

      if (landmark) {
        selectLandmark(landmark);
      }
      return;
    }

    const route = routes.find((item) => item.id_route === searchTarget.id);

    setRoutesVisible(true);
    focusRoute(searchTarget.points);

    if (route) {
      selectRoute(route);
    }
  }, [
    focusCaseById,
    focusPoint,
    focusRoute,
    handleCaseSelectionChange,
    landmarks,
    localities,
    routes,
    searchOptions,
    searchValue,
    selectLandmark,
    selectLocality,
    selectRoute,
  ]);

  const detectCaseIdAtCoordinate = useCallback(
    (map: Map | null, coordinate: [number, number]): string | null => {
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
          layerFilter: (candidateLayer) =>
            candidateLayer === casesLayerRef.current,
        },
      );
      const id = feature?.getId();

      return typeof id === "string" ? id : null;
    },
    [],
  );

  const handleLocalityTranslateEnd = useCallback(
    async (rawEvent: unknown) => {
      const origin = localityDragOriginRef.current;
      localityDragOriginRef.current = null;
      setLocalityDragging(false);

      const feature = getFirstTranslatedFeature(rawEvent);

      if (!origin || !feature) {
        return;
      }

      const locality =
        origin.family === "locality"
          ? getEditorLocalityFromPointFeature(feature)
          : null;
      const landmark =
        origin.family === "landmark"
          ? getEditorLandmarkFromPointFeature(feature)
          : null;
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
        updateEditorPointFeature(feature, {
          family: "locality",
          locality: origin.locality,
        });
        return;
      }

      if (origin.family === "landmark" && !landmark) {
        setEditorPointFeatureCoordinates(feature, origin.coordinates);
        updateEditorPointFeature(feature, {
          family: "landmark",
          landmark: origin.landmark,
        });
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
          const slotOverride =
            selectedLocalityIdRef.current === locality.id_locality &&
            localityEditDraftRef.current?.force_slot_override
              ? {
                  force_slot_override: true,
                  slot_override_reason:
                    localityEditDraftRef.current.slot_override_reason.trim() ||
                    null,
                }
              : {};
          const updated = await fetchJson<EditorMapLocality>(
            `/api/admin/editor/localities/${encodeURIComponent(locality.id_locality)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                x,
                y,
                id_case_detected: idCaseDetected,
                ...slotOverride,
              } satisfies Pick<
                EditorMapLocalityPatch,
                | "x"
                | "y"
                | "id_case_detected"
                | "force_slot_override"
                | "slot_override_reason"
              >),
            },
          );

          if (pointsSourceRef.current) {
            upsertEditorPointFeature(pointsSourceRef.current, {
              family: "locality",
              locality: updated,
            });
          }
          setLocalities((items) =>
            items.map((item) =>
              item.id_locality === updated.id_locality ? updated : item,
            ),
          );

          if (selectedLocalityIdRef.current === updated.id_locality) {
            const nextDraft = createLocalityEditDraft(updated);

            setSelectedLocality(updated);
            setLocalityEditDraft(nextDraft);
            setLocalityEditSnapshot(getLocalityEditSnapshot(nextDraft));
          }
        } else if (origin.family === "landmark" && landmark) {
          const slotOverride =
            selectedLandmarkIdRef.current === landmark.id_landmark &&
            landmarkEditDraftRef.current?.force_slot_override
              ? {
                  force_slot_override: true,
                  slot_override_reason:
                    landmarkEditDraftRef.current.slot_override_reason.trim() ||
                    null,
                }
              : {};
          const updated = await fetchJson<EditorMapLandmark>(
            `/api/admin/editor/landmarks/${encodeURIComponent(landmark.id_landmark)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                x,
                y,
                id_case_detected: idCaseDetected,
                ...slotOverride,
              } satisfies Pick<
                EditorMapLandmarkPatch,
                | "x"
                | "y"
                | "id_case_detected"
                | "force_slot_override"
                | "slot_override_reason"
              >),
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
          updateEditorPointFeature(feature, {
            family: "locality",
            locality: origin.locality,
          });
        } else {
          setEditorPointFeatureCoordinates(feature, origin.coordinates);
          updateEditorPointFeature(feature, {
            family: "landmark",
            landmark: origin.landmark,
          });
        }
        setLocalityMoveError(
          error instanceof Error
            ? error.message
            : "Deplacement du point impossible.",
        );
      } finally {
        setLocalityMoveSaving(false);
      }
    },
    [detectCaseIdAtCoordinate],
  );

  const handleRouteVertexTranslateEnd = useCallback((rawEvent: unknown) => {
    const feature = getFirstTranslatedFeature(rawEvent);

    setRouteGeometryDragging(false);

    if (!(feature instanceof Feature)) {
      return;
    }

    const routeVertex = getEditorRouteVertexFromFeature(
      feature as Feature<Geometry>,
    );
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

    void preloadCdtmBackgroundImage();

    const backgroundLayer = createCdtmBackgroundLayer();
    const casesSource = createCasesVectorSource();
    const routesSource = createEditorRoutesVectorSource();
    const routePreviewSource = createEditorRoutePreviewVectorSource();
    const routeVerticesSource = createEditorRouteVerticesVectorSource();
    const pointsSource = createEditorPointsVectorSource();
    const casesLayer = createCasesVectorLayer(
      casesSource,
      {
        getDisplayMode: () => mapDisplayModeRef.current,
        getCasePropertiesById: () => casePropertiesByIdRef.current,
        getPublicMapStyles: () => publicMapStylesRef.current,
        getSelectionState: (idCase) =>
          idCase && idCase === activeCaseIdRef.current
            ? "active"
            : idCase !== null && selectedCaseIdsRef.current.has(idCase)
              ? "selected"
              : "default",
      },
      {
        visible: casesVisibleRef.current,
      },
    );
    const pointsLayer = createEditorPointsVectorLayer(pointsSource, {
      context: {
        getIconImagePath: (iconKey) =>
          iconKey ? (mapIconSourceByKeyRef.current[iconKey] ?? null) : null,
        getLocalityDefaultIconKeyForType: (typeKey) =>
          localityDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getLandmarkDefaultIconKeyForType: (typeKey) =>
          landmarkDefaultIconKeyByTypeRef.current[typeKey] ?? null,
        getLandmarkTypeCategory: (typeKey) =>
          landmarkCategoryByTypeRef.current[typeKey] ?? null,
        getDisplayMode: () => localityDisplayModeRef.current,
        isFamilyVisible: (family) =>
          family === "locality"
            ? localitiesVisibleRef.current
            : landmarksVisibleRef.current,
      },
      visible: localitiesVisibleRef.current || landmarksVisibleRef.current,
    });
    const routesLayer = createEditorRoutesVectorLayer(routesSource, {
      visible: routesVisibleRef.current,
    });
    const routePreviewLayer = createEditorRoutePreviewVectorLayer(
      routePreviewSource,
      {
        visible: true,
      },
    );
    const routeVerticesLayer = createEditorRouteVerticesVectorLayer(
      routeVerticesSource,
      {
        visible: false,
      },
    );
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
    routeVertexTranslateInteractionRef.current =
      routeVertexTranslateInteraction;
    mapRef.current = map;
    fitCdtmCasesExtent(map, 0);
    map.addInteraction(translateInteraction);
    map.addInteraction(routeVertexTranslateInteraction);

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(mapElementRef.current);

    const translateStartKey = translateInteraction.on(
      "translatestart",
      (event: unknown) => {
        const feature = getFirstTranslatedFeature(event);

        if (!(feature instanceof Feature)) {
          localityDragOriginRef.current = null;
          return;
        }

        const locality = getEditorLocalityFromPointFeature(
          feature as Feature<Geometry>,
        );
        const localityCoordinates = getEditorPointFeatureCoordinates(
          feature as Feature<Geometry>,
        );

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

        const landmark = getEditorLandmarkFromPointFeature(
          feature as Feature<Geometry>,
        );
        const landmarkCoordinates = getEditorPointFeatureCoordinates(
          feature as Feature<Geometry>,
        );

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
      },
    ) as EventsKey;

    const translateEndKey = translateInteraction.on(
      "translateend",
      (event: unknown) => {
        void handleLocalityTranslateEnd(event);
      },
    ) as EventsKey;

    const routeVertexTranslateStartKey = routeVertexTranslateInteraction.on(
      "translatestart",
      (event: unknown) => {
        const feature = getFirstTranslatedFeature(event);

        if (!(feature instanceof Feature)) {
          return;
        }

        const routeVertex = getEditorRouteVertexFromFeature(
          feature as Feature<Geometry>,
        );

        if (
          !routeVertex ||
          routeVertex.routeId !== selectedRouteIdRef.current
        ) {
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

      if (canEditMapObjects && editorToolRef.current === "create-route") {
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

      if (canEditMapObjects && editorToolRef.current === "create-point") {
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
      const currentSelectedRouteVertexIndex =
        selectedRouteVertexIndexRef.current;

      if (canEditMapObjects && currentRouteGeometryDraft) {
        const vertexFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) =>
              candidateLayer === routeVerticesLayer,
            hitTolerance: 10,
          },
        );

        if (vertexFeature) {
          const routeVertex = getEditorRouteVertexFromFeature(
            vertexFeature as Feature<Geometry>,
          );

          if (
            routeVertex &&
            routeVertex.routeId === currentRouteGeometryDraft.id_route
          ) {
            setSelectedRouteVertexIndex(routeVertex.vertexIndex);
            setRouteGeometryTool("select-vertex");
            setRouteGeometryError(null);
            return;
          }
        }

        if (currentRouteGeometryTool === "prepend-vertex") {
          const [x, y] = event.coordinate;

          setRouteGeometryDraft({
            ...currentRouteGeometryDraft,
            points: [[x, y], ...currentRouteGeometryDraft.points],
          });
          setSelectedRouteVertexIndex(0);
          setRouteGeometryTool("select-vertex");
          setRouteGeometryError(null);
          setHoverInfo(null);
          return;
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
          currentRouteGeometryTool === "insert-before-vertex" &&
          currentSelectedRouteVertexIndex !== null
        ) {
          const [x, y] = event.coordinate;
          const nextIndex = currentSelectedRouteVertexIndex;
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

        if (
          currentRouteGeometryTool === "insert-after-vertex" &&
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

      if (
        canEditMapObjects &&
        (landmarksVisibleRef.current || localitiesVisibleRef.current)
      ) {
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
          const family = getEditorPointFamilyFromFeature(
            pointFeature as Feature<Geometry>,
          );
          if (family === "landmark") {
            const landmark = getEditorLandmarkFromPointFeature(
              pointFeature as Feature<Geometry>,
            );
            if (landmark) {
              selectLandmark(landmark);
            }
            return;
          }
          if (family === "locality") {
            const locality = getEditorLocalityFromPointFeature(
              pointFeature as Feature<Geometry>,
            );
            if (locality) {
              selectLocality(locality);
            }
          }
          return;
        }
      }

      if (canEditMapObjects && routesVisibleRef.current) {
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
          const route = getEditorRouteFromFeature(
            routeFeature as Feature<Geometry>,
          );

          if (route) {
            selectRoute(route);
            return;
          }
        }
      }

      if (!casesVisibleRef.current) {
        handleCloseLocalitySelection();
        handleCloseRouteSelection();
        handleCaseSelectionChange(null, "replace");
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
        handleCaseSelectionChange(null, "replace");
        return;
      }

      handleCloseLocalitySelection();
      handleCloseRouteSelection();
      const id = feature.getId();
      handleCaseSelectionChange(
        typeof id === "string" ? id : null,
        event.originalEvent.shiftKey ||
          event.originalEvent.ctrlKey ||
          event.originalEvent.metaKey
          ? "toggle"
          : "replace",
      );
    };

    const singleClickKey = map.on("singleclick", singleClickHandler);

    function getTooltipPosition(originalEvent: PointerEvent): {
      x: number;
      y: number;
    } {
      const viewportWidth =
        typeof window !== "undefined" ? window.innerWidth : 0;
      const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 0;
      const preferredX = originalEvent.clientX + 18;
      const preferredY = originalEvent.clientY + 18;
      const tooltipWidth = 240;
      const tooltipHeight = 120;

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
    }

    const runPointerMoveHitTests = (rawEvent: unknown) => {
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

      if (canEditMapObjects && editorToolRef.current === "create-route") {
        target.style.cursor = "crosshair";
        setHoverInfo(null);
        return;
      }

      if (
        canEditMapObjects &&
        routeGeometryDraftRef.current &&
        routeGeometryToolRef.current !== "select-vertex"
      ) {
        target.style.cursor = "crosshair";
        setHoverInfo(null);
        return;
      }

      if (canEditMapObjects && routeGeometryDraftRef.current) {
        const vertexFeature = map.forEachFeatureAtPixel(
          event.pixel,
          (candidate) => {
            if (candidate instanceof Feature) {
              return candidate as Feature<Geometry>;
            }

            return null;
          },
          {
            layerFilter: (candidateLayer) =>
              candidateLayer === routeVerticesLayer,
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

      if (
        canEditMapObjects &&
        (landmarksVisibleRef.current || localitiesVisibleRef.current)
      ) {
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
          const family = getEditorPointFamilyFromFeature(
            pointFeature as Feature<Geometry>,
          );
          if (family === "landmark") {
            const landmark = getEditorLandmarkFromPointFeature(
              pointFeature as Feature<Geometry>,
            );
            if (landmark) {
              const typeOption = referenceDataRef.current?.landmark_types.find(
                (option) => option.value === landmark.type_key,
              );
              target.style.cursor = "pointer";
              const position = getTooltipPosition(event.originalEvent);
              setHoverInfo({
                x: position.x,
                y: position.y,
                title: landmark.name,
                rows: [
                  {
                    label: "Type",
                    value: typeOption?.label ?? landmark.type_key,
                  },
                ].filter(
                  (row): row is { label: string; value: string } =>
                    row !== null,
                ),
              });
              return;
            }
          }
          if (family === "locality") {
            const locality = getEditorLocalityFromPointFeature(
              pointFeature as Feature<Geometry>,
            );
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
                ].filter(
                  (row): row is { label: string; value: string } =>
                    row !== null,
                ),
              });
              return;
            }
          }
        }
      }

      if (canEditMapObjects && routesVisibleRef.current) {
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
          const route = getEditorRouteFromFeature(
            routeFeature as Feature<Geometry>,
          );

          if (route) {
            target.style.cursor = "pointer";
            const position = getTooltipPosition(event.originalEvent);
            setHoverInfo({
              x: position.x,
              y: position.y,
              title: route.name,
              rows: [
                { label: "Type", value: route.route_type },
                {
                  label: "Geometrie",
                  value: getRouteGeometryLabel(route.geometry_mode),
                },
                {
                  label: "Style",
                  value: getRouteStrokeStyleLabel(route.stroke_style),
                },
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
      const rows = buildCaseHoverRows(mapDisplayModeRef.current, resolvedCase);

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
        title: "Case",
        rows,
      });
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

    const pointerMoveKey = map.on("pointermove", pointerMoveHandler);

    let cancelled = false;

    async function loadCases() {
      setCasesLoading(true);
      setCasesError(null);

      try {
        const [collection, publicCases] = await Promise.all([
          loadJsonData<StableCaseFeatureCollection>(CASES_DATA_URL),
          fetchJson<PublicCaseIndexResponse>("/api/cases/public-index").catch(
            (error) => {
              console.error(
                "Impossible de charger les styles publics des cases dans l'editeur.",
                error,
              );

              return {
                cases: [] as PublicCaseProperties[],
                styles: createEmptyPublicMapStyles(),
              };
            },
          ),
        ]);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error(
            "Le GeoJSON des cases ne respecte pas le contrat stable attendu.",
          );
        }

        if (cancelled || !casesSourceRef.current || !mapRef.current) {
          return;
        }

        const features = readCaseFeatures(collection, cdtmProjection);
        const nextStableCases = mergeStableCases(
          getStableCasesFromCollection(collection).map((stableCase) => ({
            ...stableCase,
            registry_id_case: stableCase.registry_id_case ?? stableCase.id_case,
          })),
          publicCases.cases,
        );
        const nextCasePropertiesById = buildCasePropertiesById(nextStableCases);

        casePropertiesByIdRef.current = nextCasePropertiesById;
        publicMapStylesRef.current = publicCases.styles;

        casesSourceRef.current.clear(true);
        casesSourceRef.current.addFeatures(features);
        casesLayerRef.current?.changed();
        setStableCases(nextStableCases);
        if (
          selectedCaseIdsRef.current.size === 0 &&
          activeCaseIdRef.current === null
        ) {
          const initialSelection = readInitialCaseSelection(
            new Set(Object.keys(nextCasePropertiesById)),
          );

          if (initialSelection.selectedCaseIds.length > 0) {
            setSelectedCaseIds(initialSelection.selectedCaseIds);
            setActiveCaseId(initialSelection.activeCaseId);
          }
        }
        setCasesCount(features.length);
        fitCdtmCasesExtent(mapRef.current, 0);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Impossible de charger les cases dans l'editeur.", error);
        setCasesCount(0);
        setCasesError(
          error instanceof Error
            ? error.message
            : "Chargement des cases impossible.",
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
        const items = await fetchJson<EditorMapRoute[]>(
          "/api/admin/editor/routes?limit=1000",
        );

        if (cancelled || !routesSourceRef.current) {
          return;
        }

        replaceEditorRouteFeatures(routesSourceRef.current, items);
        setRoutes(items);
        setRoutesCount(items.length);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Impossible de charger les routes dans l'editeur.",
          error,
        );
        setRoutes([]);
        setRoutesCount(0);
        setRoutesError(
          error instanceof Error
            ? error.message
            : "Chargement des routes impossible.",
        );
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
        const items = await fetchJson<EditorMapLocality[]>(
          "/api/admin/editor/localities?limit=1000",
        );

        if (cancelled || !pointsSourceRef.current) {
          return;
        }
        const landmarkFeatures: EditorMapLandmark[] = pointsSourceRef.current
          .getFeatures()
          .map((feature) =>
            getEditorLandmarkFromPointFeature(feature as Feature<Geometry>),
          )
          .filter((item): item is EditorMapLandmark => item !== null);
        replaceEditorPointFeatures(pointsSourceRef.current, {
          localities: items,
          landmarks: landmarkFeatures,
        });
        setLocalities(items);
        setLocalitiesCount(items.length);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Impossible de charger les localites dans l'editeur.",
          error,
        );
        setLocalities([]);
        setLocalitiesCount(0);
        setLocalitiesError(
          error instanceof Error
            ? error.message
            : "Chargement des localites impossible.",
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
        const items = await fetchJson<EditorMapLandmark[]>(
          "/api/admin/editor/landmarks?limit=1000",
        );

        if (cancelled || !pointsSourceRef.current) {
          return;
        }
        const localityFeatures: EditorMapLocality[] = pointsSourceRef.current
          .getFeatures()
          .map((feature) =>
            getEditorLocalityFromPointFeature(feature as Feature<Geometry>),
          )
          .filter((item): item is EditorMapLocality => item !== null);
        replaceEditorPointFeatures(pointsSourceRef.current, {
          localities: localityFeatures,
          landmarks: items,
        });
        setLandmarks(items);
        setLandmarksCount(items.length);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Impossible de charger les landmarks dans l'editeur.",
          error,
        );
        setLandmarks([]);
        setLandmarksCount(0);
        setLandmarksError(
          error instanceof Error
            ? error.message
            : "Chargement des landmarks impossible.",
        );
      } finally {
        if (!cancelled) {
          setLandmarksLoading(false);
        }
      }
    }

    async function loadReferenceData() {
      try {
        const data = await fetchJson<EditorReferenceData>(
          "/api/admin/editor/reference-data",
        );

        if (!cancelled) {
          setReferenceData(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Impossible de charger les referentiels editeur.",
            error,
          );
          setReferenceError(
            error instanceof Error
              ? error.message
              : "Chargement des referentiels impossible.",
          );
        }
      }
    }

    void loadCases();
    if (canEditMapObjects) {
      void loadRoutes();
      void loadLocalities();
      void loadLandmarks();
      void loadReferenceData();
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      cancelPointerMoveFrame();
      unByKey(translateStartKey);
      unByKey(translateEndKey);
      unByKey(routeVertexTranslateStartKey);
      unByKey(routeVertexTranslateEndKey);
      unByKey(singleClickKey);
      unByKey(pointerMoveKey);
      unByKey(moveStartKey);
      unByKey(moveEndKey);
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
    canEditMapObjects,
    handleCaseSelectionChange,
    handleCloseLocalitySelection,
    handleCloseRouteSelection,
    handleLocalityTranslateEnd,
    handleRouteVertexTranslateEnd,
    selectLandmark,
    selectLocality,
    selectRoute,
  ]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (selectedCaseIds.length === 0) {
        resetSingleAdminEditor(null, null);
        resetBulkAdminEditor([]);
        return;
      }

      if (isCaseMultiSelection) {
        if (selectedAdminRecords.length === selectedCaseIds.length) {
          resetBulkAdminEditor(selectedAdminRecords);
        }
        return;
      }

      resetSingleAdminEditor(activeAdminRecord, activeCase);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeAdminRecord,
    activeCase,
    isCaseMultiSelection,
    resetBulkAdminEditor,
    resetSingleAdminEditor,
    selectedAdminRecords,
    selectedCaseIdsKey,
    selectedCaseIds.length,
  ]);

  useEffect(() => {
    if (selectedCaseIds.length === 0) {
      return;
    }

    const idsToLoad = selectedCaseIds.filter(
      (idCase) => !adminRecordsById[idCase],
    );

    if (idsToLoad.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadAdminCases() {
      setAdminLoading(true);
      setAdminError(null);

      try {
        const records = await fetchAdminRecords(idsToLoad);

        if (!cancelled) {
          setAdminRecordsById((current) => {
            const next = { ...current };

            for (const record of records) {
              next[record.id_case] = record;
            }

            return next;
          });
        }
      } catch (error) {
        if (!cancelled) {
          setAdminError(
            error instanceof Error
              ? error.message
              : "Chargement admin des cases impossible.",
          );
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }

    void loadAdminCases();

    return () => {
      cancelled = true;
    };
  }, [adminRecordsById, fetchAdminRecords, selectedCaseIds]);

  const handleSingleAdminFieldChange = useCallback(
    (
      section: "public" | "terrain" | "control",
      field: string,
      value: string,
    ) => {
      setSingleDraft((current) =>
        updateSingleAdminDraftField(current, section, field, value),
      );
    },
    [],
  );

  const handleDynamicAdminFieldChange = useCallback(
    (tableKey: string, field: string, value: string) => {
      setSingleDraft((current) =>
        updateSingleDynamicAdminDraftField(current, tableKey, field, value),
      );
    },
    [],
  );

  const handleSingleBonusContextuelsChange = useCallback(
    (bonusSlugs: string[]) => {
      setSingleDraft((current) =>
        updateSingleBonusContextuelsDraft(current, bonusSlugs),
      );
    },
    [],
  );

  const handleBulkAdminFieldChange = useCallback(
    (section: keyof AdminBulkEditDraft, field: string, value: string) => {
      setBulkDraft((current) =>
        updateBulkAdminDraftField(current, section, field, value),
      );
    },
    [],
  );

  const handleBulkBonusContextuelsChange = useCallback(
    (bonusSlugs: string[]) => {
      setBulkDraft((current) =>
        updateBulkBonusContextuelsDraft(current, bonusSlugs),
      );
    },
    [],
  );

  const handleToggleCasesVisibility = useCallback(() => {
    if (
      casesVisible &&
      !confirmDiscardCaseChanges(
        "Masquer les cases fermera la selection courante et abandonnera le brouillon de case non enregistre. Continuer ?",
      )
    ) {
      return;
    }

    if (casesVisible) {
      setHoverInfo(null);
      clearCaseSelection();
    }

    setCasesVisible((visible) => !visible);
  }, [casesVisible, clearCaseSelection, confirmDiscardCaseChanges]);

  const handleToggleAllObjects = useCallback(() => {
    const nextVisible = !(
      localitiesVisible ||
      landmarksVisible ||
      routesVisible
    );

    setLocalitiesVisible(nextVisible);
    setLandmarksVisible(nextVisible);
    setRoutesVisible(nextVisible);
    setHoverInfo(null);
  }, [landmarksVisible, localitiesVisible, routesVisible]);

  const handleCancelCaseEdit = useCallback(() => {
    if (isCaseMultiSelection) {
      resetBulkAdminEditor(selectedAdminRecords);
    } else {
      resetSingleAdminEditor(activeAdminRecord, activeCase);
    }

    setAdminError(null);
  }, [
    activeAdminRecord,
    activeCase,
    isCaseMultiSelection,
    resetBulkAdminEditor,
    resetSingleAdminEditor,
    selectedAdminRecords,
  ]);

  const handleAdminSave = useCallback(async () => {
    if (selectedCaseIds.length === 0) {
      return;
    }

    setAdminSaving(true);
    setAdminError(null);

    try {
      if (isCaseMultiSelection) {
        const patch = buildBulkPatch(bulkDraft);

        await fetchJson<AdminBulkUpdateResult>("/api/admin/cases/bulk", {
          method: "PATCH",
          body: JSON.stringify({
            id_cases: selectedCaseIds,
            patch,
          }),
        });

        const refreshedRecords = await refreshAdminRecords(selectedCaseIds);

        setStableCases((current) => {
          const nextStableCases = mergePersistedRecordsIntoStableCases(
            current,
            refreshedRecords,
          );
          casePropertiesByIdRef.current =
            buildCasePropertiesById(nextStableCases);
          casesLayerRef.current?.changed();
          return nextStableCases;
        });
        resetBulkAdminEditor(refreshedRecords);
      } else {
        const currentCaseId = activeCaseId;

        if (!currentCaseId) {
          return;
        }

        const record = await fetchJson<AdminCaseRecord>(
          `/api/admin/cases/${currentCaseId}`,
          {
            method: "PUT",
            body: JSON.stringify(singleDraft),
          },
        );

        setAdminRecordsById((current) => ({
          ...current,
          [record.id_case]: record,
        }));
        setStableCases((current) => {
          const nextStableCases = mergePersistedRecordsIntoStableCases(
            current,
            [record],
          );
          casePropertiesByIdRef.current =
            buildCasePropertiesById(nextStableCases);
          casesLayerRef.current?.changed();
          return nextStableCases;
        });
        resetSingleAdminEditor(
          record,
          activeCase
            ? applyPersistedRecordToStableCase(activeCase, record)
            : record.public,
        );
      }
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setAdminSaving(false);
    }
  }, [
    activeCase,
    activeCaseId,
    bulkDraft,
    isCaseMultiSelection,
    refreshAdminRecords,
    resetBulkAdminEditor,
    resetSingleAdminEditor,
    selectedCaseIds,
    singleDraft,
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
          depends_on_locality_id: pointDraft.depends_on_locality_id,
          force_slot_override: pointDraft.force_slot_override,
          slot_override_reason: pointDraft.slot_override_reason.trim() || null,
          description: pointDraft.description.trim() || null,
        };

        const created = await fetchJson<EditorMapLocality>(
          "/api/admin/editor/localities",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        if (pointsSourceRef.current) {
          upsertEditorPointFeature(pointsSourceRef.current, {
            family: "locality",
            locality: created,
          });
        }

        setLocalitiesCount((count) => (count === null ? 1 : count + 1));
        setLocalities((items) => [...items, created]);
        selectLocality(created);
      } else {
        const payload: EditorMapLandmarkInput = {
          name: trimmedName,
          type_key:
            pointDraft.family === "unique"
              ? "lieu_unique"
              : pointDraft.type_key,
          icon_key: pointDraft.family === "unique" ? pointDraft.icon_key : null,
          x: pointDraft.x,
          y: pointDraft.y,
          id_case_detected: pointDraft.id_case_detected,
          faction: null,
          controleur: null,
          status: "draft",
          force_slot_override: pointDraft.force_slot_override,
          slot_override_reason: pointDraft.slot_override_reason.trim() || null,
          description: pointDraft.description.trim() || null,
        };

        const created = await fetchJson<EditorMapLandmark>(
          "/api/admin/editor/landmarks",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        if (pointsSourceRef.current) {
          upsertEditorPointFeature(pointsSourceRef.current, {
            family: "landmark",
            landmark: created,
          });
        }

        setLandmarksCount((count) => (count === null ? 1 : count + 1));
        setLandmarks((items) => [...items, created]);
        selectLandmark(created);
      }

      setPointDraft(null);
      setEditorTool("select");
    } catch (error) {
      setLocalitySaveError(
        error instanceof Error
          ? error.message
          : "Creation du point impossible.",
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
        depends_on_locality_id: localityEditDraft.depends_on_locality_id,
        force_slot_override: localityEditDraft.force_slot_override,
        slot_override_reason:
          localityEditDraft.slot_override_reason.trim() || null,
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

      setLocalities((items) =>
        items.map((item) =>
          item.id_locality === updated.id_locality ? updated : item,
        ),
      );
      setSelectedLocality(updated);
      setLocalityEditDraft(nextDraft);
      setLocalityEditSnapshot(getLocalityEditSnapshot(nextDraft));
    } catch (error) {
      setLocalityEditError(
        error instanceof Error
          ? error.message
          : "Mise a jour de localite impossible.",
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
      referenceData?.landmark_types.find((option) => option.value === typeKey)
        ?.category ?? null;

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
        force_slot_override: landmarkEditDraft.force_slot_override,
        slot_override_reason:
          landmarkEditDraft.slot_override_reason.trim() || null,
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

      setLandmarks((items) =>
        items.map((item) =>
          item.id_landmark === updated.id_landmark ? updated : item,
        ),
      );
      setSelectedLandmark(updated);
      setLandmarkEditDraft(nextDraft);
      setLandmarkEditSnapshot(getLandmarkEditSnapshot(nextDraft));
    } catch (error) {
      setLocalityEditError(
        error instanceof Error
          ? error.message
          : "Mise a jour de landmark impossible.",
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

      const created = await fetchJson<EditorMapRoute>(
        "/api/admin/editor/routes",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (routesSourceRef.current) {
        upsertEditorRouteFeature(routesSourceRef.current, created);
      }

      setRoutesCount((count) => (count === null ? 1 : count + 1));
      setRoutes((items) => [...items, created]);
      setRouteDraft(null);
      setEditorTool("select");
      if (routePreviewSourceRef.current) {
        clearEditorRoutePreview(routePreviewSourceRef.current);
      }
    } catch (error) {
      setRouteSaveError(
        error instanceof Error
          ? error.message
          : "Creation de route impossible.",
      );
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

      setRoutes((items) =>
        items.map((item) =>
          item.id_route === updated.id_route ? updated : item,
        ),
      );
      setSelectedRoute(updated);
      setRouteEditDraft(nextDraft);
      setRouteEditSnapshot(getRouteEditSnapshot(nextDraft));
    } catch (error) {
      setRouteEditError(
        error instanceof Error
          ? error.message
          : "Mise a jour de route impossible.",
      );
    } finally {
      setRouteEditSaving(false);
    }
  }

  function handleDeleteSelectedRouteVertex() {
    if (
      !routeGeometryDraft ||
      selectedRouteVertexIndex === null ||
      routeGeometryDraft.points.length <= 2
    ) {
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

      setRoutes((items) =>
        items.map((item) =>
          item.id_route === updated.id_route ? updated : item,
        ),
      );
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
        error instanceof Error
          ? error.message
          : "Mise a jour de geometrie impossible.",
      );
    } finally {
      setRouteGeometrySaving(false);
    }
  }

  const selectedLandmarkTypeOption =
    selectedLandmark && landmarkEditDraft
      ? (referenceData?.landmark_types.find(
          (option) => option.value === landmarkEditDraft.type_key,
        ) ?? null)
      : null;
  const selectedLandmarkCategory = selectedLandmarkTypeOption?.category ?? null;
  const pointDraftTypeOption =
    pointDraft?.family === "locality"
      ? getReferenceOption(referenceData?.locality_types, pointDraft.type_key)
      : pointDraft?.family === "landmark"
        ? getReferenceOption(referenceData?.landmark_types, pointDraft.type_key)
        : null;
  const pointDraftSlotRequirement = formatSlotRequirement(pointDraftTypeOption);
  const pointDraftUpgradeOptions =
    pointDraft?.family === "locality"
      ? getLocalityUpgradeDependencyOptions({
          referenceData,
          localities,
          typeKey: pointDraft.type_key,
          idCase: pointDraft.id_case_detected,
        })
      : [];
  const localityEditTypeOption = localityEditDraft
    ? getReferenceOption(
        referenceData?.locality_types,
        localityEditDraft.type_key,
      )
    : null;
  const localityEditSlotRequirement = formatSlotRequirement(
    localityEditTypeOption,
  );
  const localityEditUpgradeOptions =
    selectedLocality && localityEditDraft
      ? getLocalityUpgradeDependencyOptions({
          referenceData,
          localities,
          typeKey: localityEditDraft.type_key,
          idCase: selectedLocality.id_case_detected,
          excludedLocalityId: selectedLocality.id_locality,
        })
      : [];
  const landmarkEditSlotRequirement = formatSlotRequirement(
    selectedLandmarkTypeOption,
  );
  const panelTitle = routeDraft
    ? "Nouvelle route"
    : pointDraft
      ? "Nouveau point"
      : selectedRoute
        ? "Route selectionnee"
        : selectedLocality
          ? "Localite selectionnee"
          : selectedLandmark
            ? "Landmark selectionne"
            : selectedCaseIds.length > 0
              ? "Case selectionnee"
              : "Editeur";
  const mapStatusMessages = [
    localityDragging ? "Deplacement de point en cours..." : null,
    localityMoveSaving ? "Sauvegarde du deplacement..." : null,
    routeGeometryDragging ? "Deplacement de sommet en cours..." : null,
  ].filter((message): message is string => Boolean(message));
  const panelErrors = [
    casesError,
    routesError,
    localitiesError,
    landmarksError,
    referenceError,
    localityMoveError,
  ].filter((message): message is string => Boolean(message));
  const objectsVisible = localitiesVisible || landmarksVisible || routesVisible;

  return (
    <section className="grid min-h-[calc(100svh-5rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="relative min-h-[72svh] overflow-hidden rounded-[28px] bg-background/70 lg:min-h-[calc(100svh-5rem)]">
        <div className="pointer-events-none absolute right-4 top-4 z-20 w-[min(46rem,calc(100vw-7rem))]">
          <div className="pointer-events-auto flex flex-wrap items-center justify-start gap-2 rounded-[20px] border border-border/80 bg-background/92 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
            <div className="flex flex-wrap items-center gap-2">
              <details className="group relative">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-border/80 bg-background/70 px-4 text-sm font-medium text-foreground outline-none transition hover:bg-background [&::-webkit-details-marker]:hidden">
                  <span>Cases</span>
                  <ChevronDown className="size-4 transition group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 top-11 z-30 min-w-56 rounded-2xl border border-border/80 bg-background/96 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={casesVisible ? "secondary" : "outline"}
                      className="justify-start"
                      onClick={handleToggleCasesVisibility}
                    >
                      {casesVisible
                        ? "Masquer les cases"
                        : "Afficher les cases"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        mapDisplayMode === "faction" ? "secondary" : "outline"
                      }
                      className="justify-start"
                      onClick={() => setMapDisplayMode("faction")}
                    >
                      Faction
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        mapDisplayMode === "influence" ? "secondary" : "outline"
                      }
                      className="justify-start"
                      onClick={() => setMapDisplayMode("influence")}
                    >
                      Influence
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        mapDisplayMode === "topographic"
                          ? "secondary"
                          : "outline"
                      }
                      className="justify-start"
                      onClick={() => setMapDisplayMode("topographic")}
                    >
                      Topo
                    </Button>
                  </div>
                </div>
              </details>
              {canEditMapObjects ? (
                <details className="group relative">
                  <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-border/80 bg-background/70 px-4 text-sm font-medium text-foreground outline-none transition hover:bg-background [&::-webkit-details-marker]:hidden">
                    <span>Objets</span>
                    <ChevronDown className="size-4 transition group-open:rotate-180" />
                  </summary>
                  <div className="absolute left-0 top-11 z-30 min-w-56 rounded-2xl border border-border/80 bg-background/96 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={objectsVisible ? "secondary" : "outline"}
                        className="justify-start"
                        onClick={handleToggleAllObjects}
                      >
                        {objectsVisible
                          ? "Masquer les objets"
                          : "Afficher les objets"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={localitiesVisible ? "secondary" : "outline"}
                        className="justify-start"
                        onClick={() => {
                          setLocalitiesVisible((visible) => !visible);
                          setHoverInfo(null);
                        }}
                      >
                        Localites
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={landmarksVisible ? "secondary" : "outline"}
                        className="justify-start"
                        onClick={() => {
                          setLandmarksVisible((visible) => !visible);
                          setHoverInfo(null);
                        }}
                      >
                        Landmarks
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={routesVisible ? "secondary" : "outline"}
                        className="justify-start"
                        onClick={() => {
                          setRoutesVisible((visible) => !visible);
                          setHoverInfo(null);
                        }}
                      >
                        Routes
                      </Button>
                    </div>
                  </div>
                </details>
              ) : null}
              {canEditMapObjects ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLocalityDisplayMode((mode) =>
                      mode === "icons" ? "points" : "icons",
                    )
                  }
                >
                  {localityDisplayMode === "icons"
                    ? "Objets : icones"
                    : "Objets : points"}
                </Button>
              ) : null}
            </div>
            {canEditMapObjects ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    editorTool === "create-point" ? "secondary" : "outline"
                  }
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
                    setEditorTool((tool) =>
                      tool === "create-point" ? "select" : "create-point",
                    );
                    setPointDraft(null);
                    setLocalitySaveError(null);
                  }}
                >
                  {editorTool === "create-point"
                    ? "Annuler point"
                    : "Creer un point"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    editorTool === "create-route" ? "secondary" : "outline"
                  }
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
                          clearEditorRoutePreview(
                            routePreviewSourceRef.current,
                          );
                        }
                        return "select";
                      }

                      setRouteDraft(createEmptyRouteDraft());
                      setRouteSaveError(null);
                      return "create-route";
                    });
                  }}
                >
                  {editorTool === "create-route"
                    ? "Annuler route"
                    : "Creer une route"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {mapStatusMessages.length > 0 || panelErrors.length > 0 ? (
          <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[min(28rem,calc(100vw-2rem))] rounded-[18px] border border-border/80 bg-background/92 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
            <div className="space-y-1.5">
              {mapStatusMessages.map((message) => (
                <p key={message} className="text-xs text-muted-foreground">
                  {message}
                </p>
              ))}
              {panelErrors[0] ? (
                <p className="text-xs text-destructive">{panelErrors[0]}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          ref={mapElementRef}
          className="h-[72svh] w-full lg:h-[calc(100svh-5rem)]"
          aria-label="Carte editeur"
        />
      </div>
      <aside
        className="max-h-[calc(100svh-5rem)] overflow-y-auto overscroll-contain rounded-[28px] border border-border/80 bg-background/82 px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
        onPointerEnter={() => setHoverInfo(null)}
      >
        <h2 className="text-xl font-semibold text-foreground">{panelTitle}</h2>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearchSubmit();
          }}
        >
          <input
            list="editor-map-search-options"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setSearchError(null);
            }}
            placeholder="Rechercher une case ou un objet"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
          />
          <datalist id="editor-map-search-options">
            {searchOptions.map((option) => (
              <option
                key={`${option.kind}:${option.id}`}
                value={option.value}
              />
            ))}
          </datalist>
          <Button type="submit" size="sm" variant="outline">
            Rechercher
          </Button>
        </form>
        {searchError ? (
          <p className="mt-2 text-xs text-destructive">{searchError}</p>
        ) : null}
        {localityEditDirty || landmarkEditDirty ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Enregistrez ou annulez les modifications avant de deplacer le point.
          </p>
        ) : null}
        {selectedCaseIds.length > 0 &&
        !routeDraft &&
        !pointDraft &&
        !selectedRoute &&
        !selectedLocality &&
        !selectedLandmark ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              if (
                confirmDiscardCaseChanges(
                  "Deselectionner abandonnera le brouillon de case non enregistre. Continuer ?",
                )
              ) {
                clearCaseSelection();
              }
            }}
          >
            Deselectionner{" "}
            {selectedCaseIds.length > 1 ? "les cases" : "la case"}
          </Button>
        ) : null}
        {panelErrors.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {panelErrors.map((message) => (
              <p key={message} className="text-xs text-destructive">
                {message}
              </p>
            ))}
          </div>
        ) : null}
        {!routeDraft &&
        !pointDraft &&
        !selectedRoute &&
        !selectedLocality &&
        !selectedLandmark &&
        selectedCaseIds.length > 0 ? (
          <div className="mt-4">
            <CaseAdminEditor
              activeCase={activeCase}
              selectedCaseIds={selectedCaseIds}
              activeAdminRecord={activeAdminRecord}
              selectedAdminRecords={selectedAdminRecords}
              singleDraft={singleDraft}
              bulkDraft={bulkDraft}
              adminLoading={adminLoading}
              adminSaving={adminSaving}
              adminError={adminError}
              adminDirty={caseAdminDirty}
              onSingleFieldChange={handleSingleAdminFieldChange}
              onSingleBonusContextuelsChange={
                handleSingleBonusContextuelsChange
              }
              onDynamicFieldChange={handleDynamicAdminFieldChange}
              onBulkFieldChange={handleBulkAdminFieldChange}
              onBulkBonusContextuelsChange={handleBulkBonusContextuelsChange}
              onCancelEdit={handleCancelCaseEdit}
              onSave={handleAdminSave}
            />
          </div>
        ) : null}
        {!routeDraft &&
        !pointDraft &&
        !selectedRoute &&
        !selectedLocality &&
        !selectedLandmark &&
        selectedCaseIds.length === 0 ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-border/70 bg-background/35 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Cliquez sur une case pour la modifier. Les outils de localites,
              landmarks et routes sont disponibles pour les administrateurs
              techniques.
            </p>
          </div>
        ) : null}
        {routeDraft ? (
          <form
            className="mt-4 space-y-3"
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
                    draft
                      ? { ...draft, route_type: event.target.value }
                      : draft,
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
                          geometry_mode: event.target
                            .value as RouteCreateDraft["geometry_mode"],
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
                          stroke_style: event.target
                            .value as RouteCreateDraft["stroke_style"],
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
                          stroke_width: Number.parseInt(
                            event.target.value || "3",
                            10,
                          ),
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
                    draft
                      ? { ...draft, stroke_color: event.target.value }
                      : draft,
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
                    draft
                      ? { ...draft, description: event.target.value }
                      : draft,
                  )
                }
                rows={3}
                className="w-full rounded-2xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {routeDraft.points.length} point
              {routeDraft.points.length > 1 ? "s" : ""}
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
            <p className="text-sm font-semibold text-foreground">
              {selectedRoute.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {routeGeometryDraft?.points.length ?? selectedRoute.points.length}{" "}
              point
              {(routeGeometryDraft?.points.length ??
                selectedRoute.points.length) > 1
                ? "s"
                : ""}{" "}
              de controle
            </p>
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
                {routeGeometryDraft
                  ? "Fermer l'edition geometrique"
                  : "Editer la geometrie"}
              </Button>
              {routeGeometryDraft ? (
                <>
                  <Button
                    type="button"
                    variant={
                      routeGeometryTool === "prepend-vertex"
                        ? "secondary"
                        : "outline"
                    }
                    size="sm"
                    disabled={routeGeometrySaving}
                    onClick={() => {
                      setRouteGeometryTool("prepend-vertex");
                      setRouteGeometryError(null);
                    }}
                  >
                    Ajouter un sommet au debut
                  </Button>
                  <Button
                    type="button"
                    variant={
                      routeGeometryTool === "append-vertex"
                        ? "secondary"
                        : "outline"
                    }
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
                    variant={
                      routeGeometryTool === "insert-before-vertex"
                        ? "secondary"
                        : "outline"
                    }
                    size="sm"
                    disabled={
                      routeGeometrySaving || selectedRouteVertexIndex === null
                    }
                    onClick={() => {
                      setRouteGeometryTool("insert-before-vertex");
                      setRouteGeometryError(null);
                    }}
                  >
                    Inserer avant ce sommet
                  </Button>
                  <Button
                    type="button"
                    variant={
                      routeGeometryTool === "insert-after-vertex"
                        ? "secondary"
                        : "outline"
                    }
                    size="sm"
                    disabled={
                      routeGeometrySaving || selectedRouteVertexIndex === null
                    }
                    onClick={() => {
                      setRouteGeometryTool("insert-after-vertex");
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
                    Sauvegardez ou annulez la geometrie avant de modifier les
                    autres champs.
                  </p>
                ) : null}
                {routeGeometryError ? (
                  <p className="text-xs text-destructive">
                    {routeGeometryError}
                  </p>
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
                    {routeGeometrySaving
                      ? "Enregistrement..."
                      : "Enregistrer la geometrie"}
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
                    draft
                      ? { ...draft, route_type: event.target.value }
                      : draft,
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
                          geometry_mode: event.target
                            .value as RouteEditDraft["geometry_mode"],
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
                          stroke_style: event.target
                            .value as RouteEditDraft["stroke_style"],
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
                          stroke_width: Number.parseInt(
                            event.target.value || "3",
                            10,
                          ),
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
                      draft
                        ? { ...draft, stroke_color: event.target.value }
                        : draft,
                    )
                  }
                  className="h-10 w-14 rounded-xl border border-border/80 bg-background/70 px-1"
                />
                <input
                  value={routeEditDraft.stroke_color}
                  placeholder="#ffffff"
                  onChange={(event) =>
                    setRouteEditDraft((draft) =>
                      draft
                        ? { ...draft, stroke_color: event.target.value }
                        : draft,
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
                          status: event.target
                            .value as RouteEditDraft["status"],
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
                    draft
                      ? { ...draft, description: event.target.value }
                      : draft,
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
                      draft
                        ? {
                            ...draft,
                            type_key: event.target.value,
                            depends_on_locality_id: null,
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  {(pointDraft.family === "locality"
                    ? (referenceData?.locality_types ?? [])
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
            {pointDraftSlotRequirement ? (
              <p className="text-xs text-muted-foreground">
                {pointDraftSlotRequirement}
              </p>
            ) : null}
            {pointDraft.family === "locality" &&
            pointDraftTypeOption?.upgrades_from_type_id ? (
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Ameliore</span>
                <select
                  value={pointDraft.depends_on_locality_id ?? ""}
                  onChange={(event) =>
                    setPointDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            depends_on_locality_id:
                              event.target.value.trim().length > 0
                                ? event.target.value
                                : null,
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="">Nouvelle chaine</option>
                  {pointDraftUpgradeOptions.map((locality) => (
                    <option
                      key={locality.id_locality}
                      value={locality.id_locality}
                    >
                      {locality.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
                            icon_key:
                              event.target.value.trim().length > 0
                                ? event.target.value
                                : null,
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
                              event.target.value.trim().length > 0
                                ? event.target.value
                                : null,
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
                    draft
                      ? { ...draft, description: event.target.value }
                      : draft,
                  )
                }
                className="min-h-24 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Coordonnees : {Math.round(pointDraft.x)},{" "}
              {Math.round(pointDraft.y)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pointDraft.id_case_detected
                ? `Case detectee : ${pointDraft.id_case_detected}`
                : "Aucune case detectee"}
            </p>
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={pointDraft.force_slot_override}
                onChange={(event) =>
                  setPointDraft((draft) =>
                    draft
                      ? { ...draft, force_slot_override: event.target.checked }
                      : draft,
                  )
                }
              />
              <span>Forcer si les emplacements sont depasses</span>
            </label>
            {pointDraft.force_slot_override ? (
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Justification</span>
                <textarea
                  value={pointDraft.slot_override_reason}
                  onChange={(event) =>
                    setPointDraft((draft) =>
                      draft
                        ? { ...draft, slot_override_reason: event.target.value }
                        : draft,
                    )
                  }
                  className="min-h-16 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
            ) : null}
            {pointDraft.family === "unique" &&
            (referenceData?.map_icons.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucune icone active n&apos;est disponible. Le lieu unique sera
                cree avec le fallback visuel.
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
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveLocalityEdit();
            }}
          >
            <p className="text-sm font-semibold text-foreground">
              {selectedLocality.name}
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
                    draft
                      ? {
                          ...draft,
                          type_key: event.target.value,
                          depends_on_locality_id: null,
                        }
                      : draft,
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
            {localityEditSlotRequirement ? (
              <p className="text-xs text-muted-foreground">
                {localityEditSlotRequirement}
              </p>
            ) : null}
            {localityEditTypeOption?.upgrades_from_type_id ? (
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Ameliore</span>
                <select
                  value={localityEditDraft.depends_on_locality_id ?? ""}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft
                        ? {
                            ...draft,
                            depends_on_locality_id:
                              event.target.value.trim().length > 0
                                ? event.target.value
                                : null,
                          }
                        : draft,
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border/80 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  <option value="">Nouvelle chaine</option>
                  {localityEditUpgradeOptions.map((locality) => (
                    <option
                      key={locality.id_locality}
                      value={locality.id_locality}
                    >
                      {locality.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
                            event.target.value.trim().length > 0
                              ? event.target.value
                              : null,
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
                          status: event.target
                            .value as LocalityEditDraft["status"],
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
                    draft
                      ? { ...draft, description: event.target.value }
                      : draft,
                  )
                }
                className="min-h-24 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
              />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={localityEditDraft.force_slot_override}
                onChange={(event) =>
                  setLocalityEditDraft((draft) =>
                    draft
                      ? { ...draft, force_slot_override: event.target.checked }
                      : draft,
                  )
                }
              />
              <span>Forcer si les emplacements sont depasses</span>
            </label>
            {localityEditDraft.force_slot_override ? (
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Justification</span>
                <textarea
                  value={localityEditDraft.slot_override_reason}
                  onChange={(event) =>
                    setLocalityEditDraft((draft) =>
                      draft
                        ? { ...draft, slot_override_reason: event.target.value }
                        : draft,
                    )
                  }
                  className="min-h-16 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
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
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveLandmarkEdit();
            }}
          >
            <p className="text-sm font-semibold text-foreground">
              {selectedLandmark.name}
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
            {landmarkEditSlotRequirement ? (
              <p className="text-xs text-muted-foreground">
                {landmarkEditSlotRequirement}
              </p>
            ) : null}
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
                            icon_key:
                              event.target.value.trim().length > 0
                                ? event.target.value
                                : null,
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
                          status: event.target
                            .value as LandmarkEditDraft["status"],
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
                    draft
                      ? { ...draft, description: event.target.value }
                      : draft,
                  )
                }
                className="min-h-24 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
              />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={landmarkEditDraft.force_slot_override}
                onChange={(event) =>
                  setLandmarkEditDraft((draft) =>
                    draft
                      ? { ...draft, force_slot_override: event.target.checked }
                      : draft,
                  )
                }
              />
              <span>Forcer si les emplacements sont depasses</span>
            </label>
            {landmarkEditDraft.force_slot_override ? (
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block">Justification</span>
                <textarea
                  value={landmarkEditDraft.slot_override_reason}
                  onChange={(event) =>
                    setLandmarkEditDraft((draft) =>
                      draft
                        ? { ...draft, slot_override_reason: event.target.value }
                        : draft,
                    )
                  }
                  className="min-h-16 w-full rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>
            ) : null}
            {selectedLandmarkCategory === "unique" &&
            (referenceData?.map_icons.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucune icone active n&apos;est disponible. Le lieu unique
                gardera le fallback visuel.
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
      </aside>
      {hoverInfo &&
      (casesVisible ||
        routesVisible ||
        localitiesVisible ||
        landmarksVisible) ? (
        <div
          className="pointer-events-none fixed z-[80] min-w-44 rounded-[16px] border border-border/80 bg-background/92 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
          style={{
            left: hoverInfo.x,
            top: hoverInfo.y,
            transform: "translate3d(0, 0, 0)",
          }}
        >
          <p className="text-sm font-semibold text-foreground">
            {hoverInfo.title}
          </p>
          <div className="mt-2 space-y-1.5">
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
        </div>
      ) : null}
    </section>
  );
}
