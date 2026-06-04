import type {
  PublicCaseIndexResponse,
  PublicCaseProperties,
} from "@/admin/types";
import type {
  PublicMapLandmark,
  PublicMapLocality,
  PublicMapObjectsResponse,
  PublicMapReferenceIcon,
  PublicMapReferenceLandmarkType,
  PublicMapReferenceLocalityType,
  PublicMapRoute,
} from "@/map/public-objects";
import type { MapObjectPointShape } from "@/map/point-shapes";
import { listPublicMapStyles } from "@/server/admin-tech-repository";
import { ensureDatabaseReady, getPool } from "@/server/db";
import { loadStableCaseIndex } from "@/server/stable-case-source";

type PublicCaseRow = {
  id_case: string;
  public_id_case: string | null;
  region: string | null;
  sous_region: string | null;
  cote: boolean | null;
  lac: boolean | null;
  fluvial: boolean | null;
  terrain_cat: string | null;
  terrain_type: string | null;
  colline: boolean | null;
  relief: string | null;
  peuple: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
  controle_principal_type: string | null;
  controle_principal_id: string | null;
  controle_secondaire_type: string | null;
  controle_secondaire_id: string | null;
};

type PublicMapLocalityRow = {
  id: string;
  name: string;
  type_key: string;
  type_label: string | null;
  icon_key: string | null;
  marker_shape: MapObjectPointShape | null;
  marker_fill_color: string | null;
  marker_stroke_color: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  description: string | null;
};

type PublicMapLandmarkRow = {
  id: string;
  name: string;
  type_key: string;
  type_label: string | null;
  category: "landmark" | "unique" | null;
  icon_key: string | null;
  marker_shape: MapObjectPointShape | null;
  marker_fill_color: string | null;
  marker_stroke_color: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  description: string | null;
};

type PublicMapRouteRow = {
  id: string;
  name: string;
  route_type: string;
  points_json: unknown;
  geometry_mode: "straight" | "curved" | null;
  stroke_style: "solid" | "dashed" | "dotted" | null;
  stroke_width: number | null;
  stroke_color: string | null;
  description: string | null;
};

function createEmptyPublicCase(idCase: string): PublicCaseProperties {
  return {
    registry_id_case: idCase,
    id_case: idCase,
    region: null,
    sous_region: null,
    cote: null,
    lac: null,
    fluvial: null,
    terrain_cat: null,
    terrain_type: null,
    colline: null,
    relief: null,
    peuple: null,
    faction: null,
    controleur: null,
    controle_type: null,
    controle_principal_type: null,
    controle_principal_id: null,
    controle_secondaire_type: null,
    controle_secondaire_id: null,
  };
}

function mergePublicCase(
  row: PublicCaseRow,
  fallback: PublicCaseProperties,
): PublicCaseProperties {
  return {
    registry_id_case: row.id_case,
    id_case: row.public_id_case ?? fallback.id_case,
    region: row.region ?? fallback.region,
    sous_region: row.sous_region ?? fallback.sous_region,
    cote: row.cote ?? fallback.cote,
    lac: row.lac ?? fallback.lac,
    fluvial: row.fluvial ?? fallback.fluvial,
    terrain_cat: row.terrain_cat,
    terrain_type: row.terrain_type,
    colline: row.colline,
    relief: row.relief,
    peuple: row.peuple,
    faction: row.faction,
    controleur: row.controleur,
    controle_type: row.controle_type,
    controle_principal_type: row.controle_principal_type,
    controle_principal_id: row.controle_principal_id,
    controle_secondaire_type: row.controle_secondaire_type,
    controle_secondaire_id: row.controle_secondaire_id,
  };
}

function isPublicRoutePoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function normalizePublicRoutePoints(
  value: unknown,
): Array<[number, number]> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points = value
    .filter(isPublicRoutePoint)
    .map((point) => [point[0], point[1]] as [number, number]);

  return points.length >= 2 ? points : null;
}

export async function getPublicCaseIndex(): Promise<PublicCaseProperties[]> {
  const stableCaseIndex = await loadStableCaseIndex();
  const fallbackCases = Array.from(stableCaseIndex.values()).map(
    (stableCase) => ({
      registry_id_case: stableCase.registry_id_case ?? stableCase.id_case,
      id_case: stableCase.id_case,
      region: stableCase.region ?? null,
      sous_region: stableCase.sous_region ?? null,
      cote: stableCase.cote ?? null,
      lac: stableCase.lac ?? null,
      fluvial: stableCase.fluvial ?? null,
      terrain_cat: null,
      terrain_type: null,
      colline: null,
      relief: null,
      peuple: null,
      faction: null,
      controleur: null,
      controle_type: null,
      controle_principal_type: null,
      controle_principal_id: null,
      controle_secondaire_type: null,
      controle_secondaire_id: null,
    }),
  );

  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return fallbackCases;
  }

  const result = await getPool().query<PublicCaseRow>(
    `
      SELECT
        registry.id_case,
        public_current.public_id_case,
        public_current.region,
        public_current.sous_region,
        public_current.cote,
        public_current.lac,
        public_current.fluvial,
        terrain.terrain_cat,
        terrain.terrain_type,
        terrain.colline,
        terrain.relief,
        control_current.peuple,
        control_current.faction,
        control_current.controleur,
        control_current.controle_type,
        control_current.controle_principal_type,
        control_current.controle_principal_id,
        control_current.controle_secondaire_type,
        control_current.controle_secondaire_id
      FROM case_registry AS registry
      LEFT JOIN case_public_current AS public_current ON public_current.id_case = registry.id_case
      LEFT JOIN case_terrain_current AS terrain ON terrain.id_case = registry.id_case
      LEFT JOIN case_control_current AS control_current ON control_current.id_case = registry.id_case
      ORDER BY registry.id_case
    `,
  );

  return result.rows.map((row) => {
    const stableCase = stableCaseIndex.get(row.id_case);
    const fallback = stableCase
      ? {
          registry_id_case: stableCase.registry_id_case ?? stableCase.id_case,
          id_case: stableCase.id_case,
          region: stableCase.region ?? null,
          sous_region: stableCase.sous_region ?? null,
          cote: stableCase.cote ?? null,
          lac: stableCase.lac ?? null,
          fluvial: stableCase.fluvial ?? null,
          terrain_cat: null,
          terrain_type: null,
          colline: null,
          relief: null,
          peuple: null,
          faction: null,
          controleur: null,
          controle_type: null,
          controle_principal_type: null,
          controle_principal_id: null,
          controle_secondaire_type: null,
          controle_secondaire_id: null,
        }
      : createEmptyPublicCase(row.id_case);

    return mergePublicCase(row, fallback);
  });
}

export async function getPublicCaseIndexResponse(): Promise<PublicCaseIndexResponse> {
  const [cases, styles] = await Promise.all([
    getPublicCaseIndex(),
    listPublicMapStyles(),
  ]);

  return {
    cases,
    styles,
  };
}

async function listPublicLocalities(): Promise<PublicMapLocality[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return [];
  }

  const result = await getPool().query<PublicMapLocalityRow>(
    `
      SELECT
        locality.id_locality AS id,
        locality.name,
        locality.type_key,
        COALESCE(type_ref.label, type_ref.type_key) AS type_label,
        locality.icon_key,
        locality.marker_shape,
        locality.marker_fill_color,
        locality.marker_stroke_color,
        locality.x,
        locality.y,
        locality.id_case_detected,
        locality.description
      FROM map_localities AS locality
      LEFT JOIN reference_locality_types AS type_ref ON type_ref.type_key = locality.type_key
      WHERE locality.status = 'published'
      ORDER BY LOWER(locality.name) ASC, locality.id_locality ASC
    `,
  );

  return result.rows;
}

async function listPublicLandmarks(): Promise<PublicMapLandmark[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return [];
  }

  const result = await getPool().query<PublicMapLandmarkRow>(
    `
      SELECT
        landmark.id_landmark AS id,
        landmark.name,
        landmark.type_key,
        COALESCE(type_ref.label, type_ref.type_key) AS type_label,
        type_ref.category,
        landmark.icon_key,
        landmark.marker_shape,
        landmark.marker_fill_color,
        landmark.marker_stroke_color,
        landmark.x,
        landmark.y,
        landmark.id_case_detected,
        landmark.description
      FROM map_landmarks AS landmark
      LEFT JOIN reference_landmark_types AS type_ref ON type_ref.type_key = landmark.type_key
      WHERE landmark.status = 'published'
      ORDER BY LOWER(landmark.name) ASC, landmark.id_landmark ASC
    `,
  );

  return result.rows;
}

async function listPublicRoutes(): Promise<PublicMapRoute[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return [];
  }

  const result = await getPool().query<PublicMapRouteRow>(
    `
      SELECT
        id_route AS id,
        name,
        route_type,
        points_json,
        geometry_mode,
        stroke_style,
        stroke_width,
        stroke_color,
        description
      FROM map_routes
      WHERE status = 'published'
      ORDER BY LOWER(name) ASC, id_route ASC
    `,
  );

  return result.rows.flatMap((row) => {
    const points = normalizePublicRoutePoints(row.points_json);

    if (!points) {
      return [];
    }

    return [
      {
        id: row.id,
        name: row.name,
        route_type: row.route_type,
        points,
        geometry_mode: row.geometry_mode === "straight" ? "straight" : "curved",
        stroke_style:
          row.stroke_style === "dashed" || row.stroke_style === "dotted"
            ? row.stroke_style
            : "solid",
        stroke_width:
          Number.isFinite(row.stroke_width) &&
          typeof row.stroke_width === "number"
            ? row.stroke_width
            : 3,
        stroke_color: row.stroke_color ?? null,
        description: row.description ?? null,
      } satisfies PublicMapRoute,
    ];
  });
}

async function listPublicMapIconReferences(): Promise<
  PublicMapReferenceIcon[]
> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return [];
  }

  const result = await getPool().query<PublicMapReferenceIcon>(
    `
      SELECT
        icon_key AS value,
        COALESCE(label, icon_key) AS label,
        image_path,
        image_alt
      FROM reference_map_icons
      WHERE is_active = TRUE
      ORDER BY LOWER(COALESCE(label, icon_key)) ASC, icon_key ASC
    `,
  );

  return result.rows;
}

async function listPublicLocalityTypeReferences(): Promise<
  PublicMapReferenceLocalityType[]
> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return [];
  }

  const result = await getPool().query<PublicMapReferenceLocalityType>(
    `
      SELECT
        type_key AS value,
        COALESCE(label, type_key) AS label,
        default_icon_key,
        default_marker_shape,
        default_marker_fill_color,
        default_marker_stroke_color,
        consumes_slot,
        emp_requis,
        upgrades_from_type_id
      FROM reference_locality_types
      WHERE is_active = TRUE
      ORDER BY LOWER(COALESCE(label, type_key)) ASC, type_key ASC
    `,
  );

  return result.rows;
}

async function listPublicLandmarkTypeReferences(): Promise<
  PublicMapReferenceLandmarkType[]
> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return [];
  }

  const result = await getPool().query<PublicMapReferenceLandmarkType>(
    `
      SELECT
        type_key AS value,
        COALESCE(label, type_key) AS label,
        category,
        default_icon_key,
        default_marker_shape,
        default_marker_fill_color,
        default_marker_stroke_color,
        consumes_slot,
        emp_requis
      FROM reference_landmark_types
      WHERE is_active = TRUE
      ORDER BY
        LOWER(COALESCE(category, 'landmark')) ASC,
        LOWER(COALESCE(label, type_key)) ASC,
        type_key ASC
    `,
  );

  return result.rows;
}

export async function getPublicMapObjectsResponse(): Promise<PublicMapObjectsResponse> {
  const [
    localities,
    landmarks,
    routes,
    mapIcons,
    localityTypes,
    landmarkTypes,
  ] = await Promise.all([
    listPublicLocalities(),
    listPublicLandmarks(),
    listPublicRoutes(),
    listPublicMapIconReferences(),
    listPublicLocalityTypeReferences(),
    listPublicLandmarkTypeReferences(),
  ]);

  return {
    localities,
    landmarks,
    routes,
    reference: {
      map_icons: mapIcons,
      locality_types: localityTypes,
      landmark_types: landmarkTypes,
    },
  };
}
