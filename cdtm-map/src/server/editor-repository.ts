import crypto from "node:crypto";

import type { PoolClient } from "pg";

import type {
  EditorListOptions,
  EditorMapForce,
  EditorMapForceInput,
  EditorMapForcePatch,
  EditorMapLandmark,
  EditorMapLandmarkInput,
  EditorMapLandmarkPatch,
  EditorMapLocality,
  EditorMapLocalityInput,
  EditorMapLocalityPatch,
  EditorMapRoute,
  EditorMapRouteInput,
  EditorMapRoutePatch,
  EditorMapRoutePoint,
  EditorReferenceData,
  EditorReferenceOption,
  MapObjectStatus,
  MapRouteGeometryMode,
  MapRouteStrokeStyle,
} from "@/editor/types";
import {
  MAP_OBJECT_STATUSES,
  MAP_ROUTE_GEOMETRY_MODES,
  MAP_ROUTE_STROKE_STYLES,
} from "@/editor/types";
import { ensureDatabaseReady, getPool } from "@/server/db";
import {
  EditorConflictError,
  EditorEntityNotFoundError,
  EditorValidationError,
} from "@/server/editor-errors";

type EditorLocalityRow = {
  id_locality: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  depends_on_locality_id: string | null;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type EditorLandmarkRow = {
  id_landmark: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type EditorForceRow = {
  id_force: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type EditorRouteRow = {
  id_route: string;
  name: string;
  route_type: string;
  points_json: unknown;
  geometry_mode: string | null;
  stroke_style: string | null;
  stroke_width: number | null;
  stroke_color: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type EditorEntityConfig = {
  tableName: "map_localities" | "map_landmarks" | "map_forces";
  idColumn: "id_locality" | "id_landmark" | "id_force";
  typeTable: "reference_locality_types" | "reference_landmark_types" | "reference_force_types";
  typeLabel: "localite" | "landmark" | "force";
  idPrefix: "locality" | "landmark" | "force";
  dependsOnColumn?: "depends_on_locality_id";
};

type NormalizedEditorObjectInput = {
  id: string;
  name: string;
  type_key: string;
  icon_key: string | null;
  x: number;
  y: number;
  id_case_detected: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
  depends_on_locality_id: string | null;
};
type EditorEntityPatch = EditorMapLocalityPatch | EditorMapLandmarkPatch | EditorMapForcePatch;
type NormalizedEditorObjectPatch = Partial<Omit<NormalizedEditorObjectInput, "id">>;

type NormalizedEditorRouteInput = {
  id_route: string;
  name: string;
  route_type: string;
  points: EditorMapRoutePoint[];
  geometry_mode: MapRouteGeometryMode;
  stroke_style: MapRouteStrokeStyle;
  stroke_width: number;
  stroke_color: string | null;
  faction: string | null;
  controleur: string | null;
  status: MapObjectStatus;
  description: string | null;
};

type NormalizedEditorRoutePatch = Partial<Omit<NormalizedEditorRouteInput, "id_route">>;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function toIsoString(value: string | Date): string {
  return new Date(value).toISOString();
}

function isMapObjectStatus(value: unknown): value is MapObjectStatus {
  return MAP_OBJECT_STATUSES.includes(value as MapObjectStatus);
}

function normalizeRequiredStatus(value: unknown): MapObjectStatus {
  const normalized = normalizeText(value);

  if (!normalized || !isMapObjectStatus(normalized)) {
    throw new EditorValidationError("Statut invalide.");
  }

  return normalized;
}

function normalizeStatusForCreate(value: unknown): MapObjectStatus {
  if (value === undefined) {
    return "draft";
  }

  return normalizeRequiredStatus(value);
}

function isRouteGeometryMode(value: unknown): value is MapRouteGeometryMode {
  return MAP_ROUTE_GEOMETRY_MODES.includes(value as MapRouteGeometryMode);
}

function isRouteStrokeStyle(value: unknown): value is MapRouteStrokeStyle {
  return MAP_ROUTE_STROKE_STYLES.includes(value as MapRouteStrokeStyle);
}

function assertSimpleIdentifier(value: string, fieldName: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new EditorValidationError(`Le champ ${fieldName} est invalide.`);
  }

  return value;
}

function normalizeFiniteNumber(value: unknown, fieldName: string): number {
  if (value === null || value === undefined) {
    throw new EditorValidationError(`Le champ ${fieldName} est invalide.`);
  }

  if (typeof value === "string" && value.trim().length === 0) {
    throw new EditorValidationError(`Le champ ${fieldName} est invalide.`);
  }

  const nextValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(nextValue)) {
    throw new EditorValidationError(`Le champ ${fieldName} est invalide.`);
  }

  return nextValue;
}

function generateEditorObjectId(prefix: EditorEntityConfig["idPrefix"]): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function generateEditorRouteId(): string {
  return `route_${crypto.randomUUID().replaceAll("-", "")}`;
}

function normalizeSearch(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeLimit(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 250;
  }

  return Math.min(Math.max(Math.trunc(value as number), 1), 1000);
}

function normalizeRouteGeometryMode(value: unknown): MapRouteGeometryMode {
  if (value === undefined) {
    return "curved";
  }

  const normalized = normalizeText(value);

  if (!isRouteGeometryMode(normalized)) {
    throw new EditorValidationError("Le mode de geometrie est invalide.");
  }

  return normalized;
}

function normalizeRouteStrokeStyle(value: unknown): MapRouteStrokeStyle {
  if (value === undefined) {
    return "solid";
  }

  const normalized = normalizeText(value);

  if (!isRouteStrokeStyle(normalized)) {
    throw new EditorValidationError("Le style de trait est invalide.");
  }

  return normalized;
}

function normalizeRouteStrokeWidth(value: unknown): number {
  if (value === undefined) {
    return 3;
  }

  const normalized = normalizeFiniteNumber(value, "stroke_width");

  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 12) {
    throw new EditorValidationError("La largeur de trait est invalide.");
  }

  return normalized;
}

function normalizeRouteStrokeColor(value: unknown): string | null {
  const normalized = normalizeNullableText(value);

  if (!normalized) {
    return null;
  }

  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    throw new EditorValidationError("La couleur de trait est invalide.");
  }

  return normalized;
}

function normalizeRoutePoint(
  value: unknown,
  index: number,
): EditorMapRoutePoint {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new EditorValidationError(`Le point ${index + 1} de la route est invalide.`);
  }

  return [
    normalizeFiniteNumber(value[0], `points[${index}][0]`),
    normalizeFiniteNumber(value[1], `points[${index}][1]`),
  ];
}

function normalizeRoutePoints(value: unknown): EditorMapRoutePoint[] {
  if (!Array.isArray(value)) {
    throw new EditorValidationError("Les points de la route sont invalides.");
  }

  const points = value.map((point, index) => normalizeRoutePoint(point, index));

  if (points.length < 2) {
    throw new EditorValidationError("Une route doit contenir au moins deux points.");
  }

  return points;
}

function normalizeRoutePointsFromStorage(
  value: unknown,
  routeId: string,
): EditorMapRoutePoint[] {
  try {
    return normalizeRoutePoints(value);
  } catch (error) {
    throw new Error(
      `Les points stockes de la route ${routeId} sont invalides: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function mapLocalityRow(row: EditorLocalityRow): EditorMapLocality {
  return {
    id_locality: row.id_locality,
    name: row.name,
    type_key: row.type_key,
    icon_key: row.icon_key,
    x: row.x,
    y: row.y,
    id_case_detected: row.id_case_detected,
    faction: row.faction,
    controleur: row.controleur,
    status: row.status,
    depends_on_locality_id: row.depends_on_locality_id,
    description: row.description,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapLandmarkRow(row: EditorLandmarkRow): EditorMapLandmark {
  return {
    id_landmark: row.id_landmark,
    name: row.name,
    type_key: row.type_key,
    icon_key: row.icon_key,
    x: row.x,
    y: row.y,
    id_case_detected: row.id_case_detected,
    faction: row.faction,
    controleur: row.controleur,
    status: row.status,
    description: row.description,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapForceRow(row: EditorForceRow): EditorMapForce {
  return {
    id_force: row.id_force,
    name: row.name,
    type_key: row.type_key,
    icon_key: row.icon_key,
    x: row.x,
    y: row.y,
    id_case_detected: row.id_case_detected,
    faction: row.faction,
    controleur: row.controleur,
    status: row.status,
    description: row.description,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapRouteRow(row: EditorRouteRow): EditorMapRoute {
  return {
    id_route: row.id_route,
    name: row.name,
    route_type: row.route_type,
    points: normalizeRoutePointsFromStorage(row.points_json, row.id_route),
    geometry_mode: isRouteGeometryMode(row.geometry_mode) ? row.geometry_mode : "curved",
    stroke_style: isRouteStrokeStyle(row.stroke_style) ? row.stroke_style : "solid",
    stroke_width:
      typeof row.stroke_width === "number" &&
      Number.isInteger(row.stroke_width) &&
      row.stroke_width >= 1 &&
      row.stroke_width <= 12
        ? row.stroke_width
        : 3,
    stroke_color: normalizeRouteStrokeColor(row.stroke_color),
    faction: row.faction,
    controleur: row.controleur,
    status: row.status,
    description: row.description,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

async function assertValueExists(
  client: PoolClient,
  tableName: string,
  columnName: string,
  value: string | null,
  errorMessage: string,
): Promise<void> {
  if (!value) {
    return;
  }

  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM ${tableName}
        WHERE ${columnName} = $1
      ) AS exists
    `,
    [value],
  );

  if (!result.rows[0]?.exists) {
    throw new EditorValidationError(errorMessage);
  }
}

async function validateEditorObjectReferences(
  client: PoolClient,
  config: EditorEntityConfig,
  input: NormalizedEditorObjectInput,
): Promise<void> {
  await assertValueExists(
    client,
    config.typeTable,
    "type_key",
    input.type_key,
    `Le type de ${config.typeLabel} est invalide.`,
  );
  await assertValueExists(
    client,
    "reference_map_icons",
    "icon_key",
    input.icon_key,
    "L'icone de carte est invalide.",
  );
  await assertValueExists(
    client,
    "reference_factions",
    "id_faction",
    input.faction,
    "La faction est invalide.",
  );
  await assertValueExists(
    client,
    "reference_controleurs",
    "id_controleur",
    input.controleur,
    "Le controleur est invalide.",
  );
  await assertValueExists(
    client,
    "case_registry",
    "id_case",
    input.id_case_detected,
    "La case detectee est invalide.",
  );

  if (config.dependsOnColumn) {
    if (input.depends_on_locality_id && input.depends_on_locality_id === input.id) {
      throw new EditorValidationError("Une localite ne peut pas dependre d'elle-meme.");
    }

    await assertValueExists(
      client,
      "map_localities",
      "id_locality",
      input.depends_on_locality_id,
      "La dependance de localite est invalide.",
    );
  }
}

async function validateEditorRouteReferences(
  client: PoolClient,
  input: NormalizedEditorRouteInput,
): Promise<void> {
  await assertValueExists(
    client,
    "reference_factions",
    "id_faction",
    input.faction,
    "La faction est invalide.",
  );
  await assertValueExists(
    client,
    "reference_controleurs",
    "id_controleur",
    input.controleur,
    "Le controleur est invalide.",
  );
}

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EditorValidationError("Payload invalide.");
  }

  return value as Record<string, unknown>;
}

function normalizeEditorRouteInput(
  input: EditorMapRouteInput | EditorMapRoutePatch,
  providedId?: string,
): NormalizedEditorRouteInput {
  const name = normalizeRequiredStringField(input.name, "name");
  const routeType = assertSimpleIdentifier(
    normalizeRequiredStringField(input.route_type, "route_type"),
    "route_type",
  );
  const nextId =
    providedId !== undefined
      ? assertSimpleIdentifier(providedId, "id_route")
      : assertSimpleIdentifier(
          normalizeText((input as EditorMapRouteInput).id_route) || generateEditorRouteId(),
          "id_route",
        );

  return {
    id_route: nextId,
    name,
    route_type: routeType,
    points: normalizeRoutePoints(input.points),
    geometry_mode: normalizeRouteGeometryMode(input.geometry_mode),
    stroke_style: normalizeRouteStrokeStyle(input.stroke_style),
    stroke_width: normalizeRouteStrokeWidth(input.stroke_width),
    stroke_color: normalizeRouteStrokeColor(input.stroke_color),
    faction: normalizeNullableText(input.faction),
    controleur: normalizeNullableText(input.controleur),
    status: normalizeStatusForCreate(input.status),
    description: normalizeNullableText(input.description),
  };
}

function normalizeEditorRoutePatch(input: EditorMapRoutePatch): NormalizedEditorRoutePatch {
  const payload = assertPlainObject(input);
  const patch: NormalizedEditorRoutePatch = {};
  const allowedFields = new Set([
    "name",
    "route_type",
    "points",
    "geometry_mode",
    "stroke_style",
    "stroke_width",
    "stroke_color",
    "faction",
    "controleur",
    "status",
    "description",
  ]);

  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      throw new EditorValidationError(`Le champ ${key} ne peut pas etre modifie.`);
    }

    const value = payload[key];

    switch (key) {
      case "name":
        patch.name = normalizeRequiredStringField(value, "name");
        break;
      case "route_type":
        patch.route_type = assertSimpleIdentifier(
          normalizeRequiredStringField(value, "route_type"),
          "route_type",
        );
        break;
      case "points":
        patch.points = normalizeRoutePoints(value);
        break;
      case "geometry_mode":
        patch.geometry_mode = normalizeRouteGeometryMode(value);
        break;
      case "stroke_style":
        patch.stroke_style = normalizeRouteStrokeStyle(value);
        break;
      case "stroke_width":
        patch.stroke_width = normalizeRouteStrokeWidth(value);
        break;
      case "stroke_color":
        patch.stroke_color = normalizeRouteStrokeColor(value);
        break;
      case "faction":
        patch.faction = normalizeNullableText(value);
        break;
      case "controleur":
        patch.controleur = normalizeNullableText(value);
        break;
      case "status":
        patch.status = normalizeRequiredStatus(value);
        break;
      case "description":
        patch.description = normalizeNullableText(value);
        break;
      default:
        throw new EditorValidationError(`Le champ ${key} ne peut pas etre modifie.`);
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new EditorValidationError("Le patch ne peut pas etre vide.");
  }

  return patch;
}

function getAllowedPatchFields(config: EditorEntityConfig): Set<string> {
  return new Set([
    "name",
    "type_key",
    "icon_key",
    "x",
    "y",
    "id_case_detected",
    "faction",
    "controleur",
    "status",
    "description",
    ...(config.dependsOnColumn ? [config.dependsOnColumn] : []),
  ]);
}

function normalizeRequiredStringField(value: unknown, fieldName: string): string {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new EditorValidationError(`Le champ ${fieldName} est obligatoire.`);
  }

  return normalized;
}

function normalizeEditorObjectInput(
  config: EditorEntityConfig,
  input:
    | EditorMapLocalityInput
    | EditorMapLandmarkInput
    | EditorMapForceInput
    | EditorMapLocalityPatch
    | EditorMapLandmarkPatch
    | EditorMapForcePatch,
  providedId?: string,
): NormalizedEditorObjectInput {
  const name = normalizeRequiredStringField(input.name, "name");
  const typeKey = normalizeRequiredStringField(input.type_key, "type_key");

  const nextId =
    providedId !== undefined
      ? assertSimpleIdentifier(providedId, config.idColumn)
      : assertSimpleIdentifier(
          normalizeText((input as EditorMapLocalityInput & EditorMapLandmarkInput & EditorMapForceInput)[config.idColumn]) ||
            generateEditorObjectId(config.idPrefix),
          config.idColumn,
        );

  return {
    id: nextId,
    name,
    type_key: typeKey,
    icon_key: normalizeNullableText(input.icon_key),
    x: normalizeFiniteNumber(input.x, "x"),
    y: normalizeFiniteNumber(input.y, "y"),
    id_case_detected: normalizeNullableText(input.id_case_detected),
    faction: normalizeNullableText(input.faction),
    controleur: normalizeNullableText(input.controleur),
    status: normalizeStatusForCreate(input.status),
    description: normalizeNullableText(input.description),
    depends_on_locality_id: config.dependsOnColumn
      ? normalizeNullableText((input as EditorMapLocalityInput).depends_on_locality_id)
      : null,
  };
}

function normalizeEditorObjectPatch(
  config: EditorEntityConfig,
  input: EditorEntityPatch,
): NormalizedEditorObjectPatch {
  const payload = assertPlainObject(input);
  const allowedFields = getAllowedPatchFields(config);
  const patch: NormalizedEditorObjectPatch = {};

  for (const key of Object.keys(payload)) {
    if (!allowedFields.has(key)) {
      throw new EditorValidationError(`Le champ ${key} ne peut pas etre modifie.`);
    }

    const value = payload[key];

    switch (key) {
      case "name":
        patch.name = normalizeRequiredStringField(value, "name");
        break;
      case "type_key":
        patch.type_key = normalizeRequiredStringField(value, "type_key");
        break;
      case "icon_key":
        patch.icon_key = normalizeNullableText(value);
        break;
      case "x":
        patch.x = normalizeFiniteNumber(value, "x");
        break;
      case "y":
        patch.y = normalizeFiniteNumber(value, "y");
        break;
      case "id_case_detected":
        patch.id_case_detected = normalizeNullableText(value);
        break;
      case "faction":
        patch.faction = normalizeNullableText(value);
        break;
      case "controleur":
        patch.controleur = normalizeNullableText(value);
        break;
      case "status":
        patch.status = normalizeRequiredStatus(value);
        break;
      case "description":
        patch.description = normalizeNullableText(value);
        break;
      case "depends_on_locality_id":
        patch.depends_on_locality_id = normalizeNullableText(value);
        break;
      default:
        throw new EditorValidationError(`Le champ ${key} ne peut pas etre modifie.`);
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new EditorValidationError("Le patch ne peut pas etre vide.");
  }

  return patch;
}

function mapRowToNormalizedInput(
  config: EditorEntityConfig,
  row: EditorLocalityRow | EditorLandmarkRow | EditorForceRow,
): NormalizedEditorObjectInput {
  let id: string;

  if (config.idColumn === "id_locality" && "id_locality" in row) {
    id = row.id_locality;
  } else if (config.idColumn === "id_landmark" && "id_landmark" in row) {
    id = row.id_landmark;
  } else if (config.idColumn === "id_force" && "id_force" in row) {
    id = row.id_force;
  } else {
    throw new Error("Ligne editeur incoherente.");
  }

  return {
    id,
    name: row.name,
    type_key: row.type_key,
    icon_key: row.icon_key,
    x: row.x,
    y: row.y,
    id_case_detected: row.id_case_detected,
    faction: row.faction,
    controleur: row.controleur,
    status: row.status,
    description: row.description,
    depends_on_locality_id:
      config.dependsOnColumn && "depends_on_locality_id" in row
        ? (row.depends_on_locality_id ?? null)
        : null,
  };
}

function mapDatabaseError(error: unknown, fallbackMessage: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    throw new EditorConflictError(fallbackMessage);
  }

  throw error;
}

function buildListQuery(
  config: EditorEntityConfig,
  options: EditorListOptions | undefined,
): { sql: string; values: Array<string | number> } {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (options?.status && isMapObjectStatus(options.status)) {
    values.push(options.status);
    clauses.push(`status = $${values.length}`);
  }

  if (options?.type_key) {
    values.push(options.type_key);
    clauses.push(`type_key = $${values.length}`);
  }

  if (options?.faction) {
    values.push(options.faction);
    clauses.push(`faction = $${values.length}`);
  }

  if (options?.controleur) {
    values.push(options.controleur);
    clauses.push(`controleur = $${values.length}`);
  }

  const search = normalizeSearch(options?.search ?? null);

  if (search) {
    values.push(`%${search}%`);
    clauses.push(`(name ILIKE $${values.length} OR COALESCE(description, '') ILIKE $${values.length})`);
  }

  values.push(normalizeLimit(options?.limit ?? null));

  return {
    sql: `
      SELECT *
      FROM ${config.tableName}
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY LOWER(name) ASC, ${config.idColumn} ASC
      LIMIT $${values.length}
    `,
    values,
  };
}

function buildRouteListQuery(
  options: EditorListOptions | undefined,
): { sql: string; values: Array<string | number> } {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (options?.status && isMapObjectStatus(options.status)) {
    values.push(options.status);
    clauses.push(`status = $${values.length}`);
  }

  if (options?.type_key) {
    values.push(options.type_key);
    clauses.push(`route_type = $${values.length}`);
  }

  if (options?.faction) {
    values.push(options.faction);
    clauses.push(`faction = $${values.length}`);
  }

  if (options?.controleur) {
    values.push(options.controleur);
    clauses.push(`controleur = $${values.length}`);
  }

  const search = normalizeSearch(options?.search ?? null);

  if (search) {
    values.push(`%${search}%`);
    clauses.push(
      `(name ILIKE $${values.length} OR route_type ILIKE $${values.length} OR COALESCE(description, '') ILIKE $${values.length})`,
    );
  }

  values.push(normalizeLimit(options?.limit ?? null));

  return {
    sql: `
      SELECT *
      FROM map_routes
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY LOWER(name) ASC, id_route ASC
      LIMIT $${values.length}
    `,
    values,
  };
}

async function listReferenceOptions(
  client: PoolClient,
  tableName: string,
  valueColumn: string,
  labelExpression: string,
  whereClause = "",
  values: Array<string | boolean> = [],
): Promise<EditorReferenceOption[]> {
  const result = await client.query<{ value: string; label: string }>(
    `
      SELECT ${valueColumn} AS value, ${labelExpression} AS label
      FROM ${tableName}
      ${whereClause}
      ORDER BY LOWER(${labelExpression}) ASC, ${valueColumn} ASC
    `,
    values,
  );

  return result.rows;
}

async function listEditorLocalityTypeOptions(
  client: PoolClient,
): Promise<EditorReferenceOption[]> {
  const result = await client.query<EditorReferenceOption>(
    `
      SELECT
        type_key AS value,
        COALESCE(label, type_key) AS label,
        default_icon_key
      FROM reference_locality_types
      WHERE is_active = TRUE
      ORDER BY LOWER(COALESCE(label, type_key)) ASC, type_key ASC
    `,
  );

  return result.rows;
}

async function listEditorLandmarkTypeOptions(
  client: PoolClient,
): Promise<EditorReferenceOption[]> {
  const result = await client.query<EditorReferenceOption>(
    `
      SELECT
        type_key AS value,
        COALESCE(label, type_key) AS label,
        category,
        default_icon_key
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

async function listEditorMapIconOptions(
  client: PoolClient,
): Promise<EditorReferenceOption[]> {
  const result = await client.query<EditorReferenceOption>(
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

async function getEditorReferenceDataInternal(client: PoolClient): Promise<EditorReferenceData> {
  const [localityTypes, landmarkTypes, forceTypes, mapIcons, factions, controleurs] =
    await Promise.all([
      listEditorLocalityTypeOptions(client),
      listEditorLandmarkTypeOptions(client),
      listReferenceOptions(
        client,
        "reference_force_types",
        "type_key",
        "COALESCE(label, type_key)",
        "WHERE is_active = TRUE",
      ),
      listEditorMapIconOptions(client),
      listReferenceOptions(client, "reference_factions", "id_faction", "COALESCE(nom, id_faction)"),
      listReferenceOptions(
        client,
        "reference_controleurs",
        "id_controleur",
        "COALESCE(nom, id_controleur)",
      ),
    ]);

  return {
    locality_types: localityTypes,
    landmark_types: landmarkTypes,
    force_types: forceTypes,
    map_icons: mapIcons,
    factions,
    controleurs,
  };
}

async function getEditorEntityRow<T extends EditorLocalityRow | EditorLandmarkRow | EditorForceRow>(
  client: PoolClient,
  config: EditorEntityConfig,
  id: string,
): Promise<T> {
  const result = await client.query<T>(
    `
      SELECT *
      FROM ${config.tableName}
      WHERE ${config.idColumn} = $1
      LIMIT 1
    `,
    [id],
  );

  const row = result.rows[0];

  if (!row) {
    throw new EditorEntityNotFoundError(`Objet ${id} introuvable.`);
  }

  return row;
}

async function createEditorEntity<T extends EditorLocalityRow | EditorLandmarkRow | EditorForceRow>(
  client: PoolClient,
  config: EditorEntityConfig,
  input:
    | EditorMapLocalityInput
    | EditorMapLandmarkInput
    | EditorMapForceInput,
  userId: number,
): Promise<T> {
  const normalized = normalizeEditorObjectInput(config, input);
  await validateEditorObjectReferences(client, config, normalized);

  const columns = [
    config.idColumn,
    "name",
    "type_key",
    "icon_key",
    "x",
    "y",
    "id_case_detected",
    "faction",
    "controleur",
    "status",
    ...(config.dependsOnColumn ? [config.dependsOnColumn] : []),
    "description",
    "updated_by_user_id",
  ];

  const values = [
    normalized.id,
    normalized.name,
    normalized.type_key,
    normalized.icon_key,
    normalized.x,
    normalized.y,
    normalized.id_case_detected,
    normalized.faction,
    normalized.controleur,
    normalized.status,
    ...(config.dependsOnColumn ? [normalized.depends_on_locality_id] : []),
    normalized.description,
    userId,
  ];

  let result;
  try {
    result = await client.query<T>(
      `
        INSERT INTO ${config.tableName} (${columns.join(", ")})
        VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
        RETURNING *
      `,
      values,
    );
  } catch (error) {
    mapDatabaseError(error, `Un objet ${normalized.id} existe deja.`);
  }

  const row = result.rows[0];

  if (!row) {
    throw new EditorConflictError("Creation impossible.");
  }

  return row;
}

async function updateEditorEntity<T extends EditorLocalityRow | EditorLandmarkRow | EditorForceRow>(
  client: PoolClient,
  config: EditorEntityConfig,
  id: string,
  input: EditorEntityPatch,
  userId: number,
): Promise<T> {
  const existingRow = await getEditorEntityRow<T>(client, config, id);
  const patch = normalizeEditorObjectPatch(config, input);
  const merged = {
    ...mapRowToNormalizedInput(config, existingRow),
    ...patch,
  };

  await validateEditorObjectReferences(client, config, merged);

  const assignments: string[] = [];
  const values: Array<string | number | null> = [id];
  let parameterIndex = 2;

  for (const [fieldName, fieldValue] of Object.entries(patch)) {
    const columnName = fieldName === "depends_on_locality_id" ? config.dependsOnColumn : fieldName;

    if (!columnName) {
      continue;
    }

    assignments.push(`${columnName} = $${parameterIndex}`);
    values.push(fieldValue as string | number | null);
    parameterIndex += 1;
  }

  assignments.push(`updated_by_user_id = $${parameterIndex}`);
  values.push(userId);
  parameterIndex += 1;
  assignments.push("updated_at = NOW()");

  const result = await client.query<T>(
    `
      UPDATE ${config.tableName}
      SET ${assignments.join(", ")}
      WHERE ${config.idColumn} = $1
      RETURNING *
    `,
    values,
  );

  const row = result.rows[0];

  if (!row) {
    throw new EditorEntityNotFoundError(`Objet ${id} introuvable.`);
  }

  return row;
}

async function deleteEditorEntity(
  client: PoolClient,
  config: EditorEntityConfig,
  id: string,
): Promise<void> {
  const result = await client.query(
    `
      DELETE FROM ${config.tableName}
      WHERE ${config.idColumn} = $1
    `,
    [id],
  );

  if (result.rowCount === 0) {
    throw new EditorEntityNotFoundError(`Objet ${id} introuvable.`);
  }
}

async function getEditorRouteRow(
  client: PoolClient,
  id: string,
): Promise<EditorRouteRow> {
  const result = await client.query<EditorRouteRow>(
    `
      SELECT *
      FROM map_routes
      WHERE id_route = $1
      LIMIT 1
    `,
    [id],
  );

  const row = result.rows[0];

  if (!row) {
    throw new EditorEntityNotFoundError(`Route ${id} introuvable.`);
  }

  return row;
}

async function createEditorRouteInternal(
  client: PoolClient,
  input: EditorMapRouteInput,
  userId: number,
): Promise<EditorRouteRow> {
  const normalized = normalizeEditorRouteInput(input);
  await validateEditorRouteReferences(client, normalized);

  let result;
  try {
    result = await client.query<EditorRouteRow>(
      `
        INSERT INTO map_routes (
          id_route,
          name,
          route_type,
          points_json,
          geometry_mode,
          stroke_style,
          stroke_width,
          stroke_color,
          faction,
          controleur,
          status,
          description,
          updated_by_user_id
        )
        VALUES (
          $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING *
      `,
      [
        normalized.id_route,
        normalized.name,
        normalized.route_type,
        JSON.stringify(normalized.points),
        normalized.geometry_mode,
        normalized.stroke_style,
        normalized.stroke_width,
        normalized.stroke_color,
        normalized.faction,
        normalized.controleur,
        normalized.status,
        normalized.description,
        userId,
      ],
    );
  } catch (error) {
    mapDatabaseError(error, `Une route ${normalized.id_route} existe deja.`);
  }

  const row = result.rows[0];

  if (!row) {
    throw new EditorConflictError("Creation de route impossible.");
  }

  return row;
}

async function updateEditorRouteInternal(
  client: PoolClient,
  id: string,
  input: EditorMapRoutePatch,
  userId: number,
): Promise<EditorRouteRow> {
  const existingRow = await getEditorRouteRow(client, id);
  const patch = normalizeEditorRoutePatch(input);
  const merged: NormalizedEditorRouteInput = {
    id_route: existingRow.id_route,
    name: existingRow.name,
    route_type: existingRow.route_type,
    points: normalizeRoutePointsFromStorage(existingRow.points_json, existingRow.id_route),
    geometry_mode: normalizeRouteGeometryMode(existingRow.geometry_mode),
    stroke_style: normalizeRouteStrokeStyle(existingRow.stroke_style),
    stroke_width: normalizeRouteStrokeWidth(existingRow.stroke_width),
    stroke_color: normalizeRouteStrokeColor(existingRow.stroke_color),
    faction: existingRow.faction,
    controleur: existingRow.controleur,
    status: existingRow.status,
    description: existingRow.description,
    ...patch,
  };

  await validateEditorRouteReferences(client, merged);

  const assignments: string[] = [];
  const values: Array<string | number | null> = [id];
  let parameterIndex = 2;

  for (const [fieldName, fieldValue] of Object.entries(patch)) {
    const columnName = fieldName === "points" ? "points_json" : fieldName;
    assignments.push(`${columnName} = $${parameterIndex}${fieldName === "points" ? "::jsonb" : ""}`);
    values.push(
      fieldName === "points" ? JSON.stringify(fieldValue as EditorMapRoutePoint[]) : (fieldValue as string | number | null),
    );
    parameterIndex += 1;
  }

  assignments.push(`updated_by_user_id = $${parameterIndex}`);
  values.push(userId);
  assignments.push("updated_at = NOW()");

  const result = await client.query<EditorRouteRow>(
    `
      UPDATE map_routes
      SET ${assignments.join(", ")}
      WHERE id_route = $1
      RETURNING *
    `,
    values,
  );

  const row = result.rows[0];

  if (!row) {
    throw new EditorEntityNotFoundError(`Route ${id} introuvable.`);
  }

  return row;
}

async function deleteEditorRouteInternal(client: PoolClient, id: string): Promise<void> {
  const result = await client.query(
    `
      DELETE FROM map_routes
      WHERE id_route = $1
    `,
    [id],
  );

  if (result.rowCount === 0) {
    throw new EditorEntityNotFoundError(`Route ${id} introuvable.`);
  }
}

const LOCALITY_CONFIG: EditorEntityConfig = {
  tableName: "map_localities",
  idColumn: "id_locality",
  typeTable: "reference_locality_types",
  typeLabel: "localite",
  idPrefix: "locality",
  dependsOnColumn: "depends_on_locality_id",
};

const LANDMARK_CONFIG: EditorEntityConfig = {
  tableName: "map_landmarks",
  idColumn: "id_landmark",
  typeTable: "reference_landmark_types",
  typeLabel: "landmark",
  idPrefix: "landmark",
};

const FORCE_CONFIG: EditorEntityConfig = {
  tableName: "map_forces",
  idColumn: "id_force",
  typeTable: "reference_force_types",
  typeLabel: "force",
  idPrefix: "force",
};

export async function getEditorReferenceData(): Promise<EditorReferenceData> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    return await getEditorReferenceDataInternal(client);
  } finally {
    client.release();
  }
}

export async function listEditorLocalities(options?: EditorListOptions): Promise<EditorMapLocality[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    const query = buildListQuery(LOCALITY_CONFIG, options);
    const result = await client.query<EditorLocalityRow>(query.sql, query.values);
    return result.rows.map(mapLocalityRow);
  } finally {
    client.release();
  }
}

export async function getEditorLocality(id: string): Promise<EditorMapLocality> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    return mapLocalityRow(await getEditorEntityRow<EditorLocalityRow>(client, LOCALITY_CONFIG, id));
  } finally {
    client.release();
  }
}

export async function createEditorLocality(
  input: EditorMapLocalityInput,
  userId: number,
): Promise<EditorMapLocality> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await createEditorEntity<EditorLocalityRow>(client, LOCALITY_CONFIG, input, userId);
    await client.query("COMMIT");
    return mapLocalityRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEditorLocality(
  id: string,
  input: EditorMapLocalityPatch,
  userId: number,
): Promise<EditorMapLocality> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await updateEditorEntity<EditorLocalityRow>(client, LOCALITY_CONFIG, id, input, userId);
    await client.query("COMMIT");
    return mapLocalityRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEditorLocality(id: string): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await deleteEditorEntity(client, LOCALITY_CONFIG, id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listEditorLandmarks(options?: EditorListOptions): Promise<EditorMapLandmark[]> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    const query = buildListQuery(LANDMARK_CONFIG, options);
    const result = await client.query<EditorLandmarkRow>(query.sql, query.values);
    return result.rows.map(mapLandmarkRow);
  } finally {
    client.release();
  }
}

export async function getEditorLandmark(id: string): Promise<EditorMapLandmark> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    return mapLandmarkRow(await getEditorEntityRow<EditorLandmarkRow>(client, LANDMARK_CONFIG, id));
  } finally {
    client.release();
  }
}

export async function createEditorLandmark(
  input: EditorMapLandmarkInput,
  userId: number,
): Promise<EditorMapLandmark> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await createEditorEntity<EditorLandmarkRow>(client, LANDMARK_CONFIG, input, userId);
    await client.query("COMMIT");
    return mapLandmarkRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEditorLandmark(
  id: string,
  input: EditorMapLandmarkPatch,
  userId: number,
): Promise<EditorMapLandmark> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await updateEditorEntity<EditorLandmarkRow>(client, LANDMARK_CONFIG, id, input, userId);
    await client.query("COMMIT");
    return mapLandmarkRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEditorLandmark(id: string): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await deleteEditorEntity(client, LANDMARK_CONFIG, id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listEditorForces(options?: EditorListOptions): Promise<EditorMapForce[]> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    const query = buildListQuery(FORCE_CONFIG, options);
    const result = await client.query<EditorForceRow>(query.sql, query.values);
    return result.rows.map(mapForceRow);
  } finally {
    client.release();
  }
}

export async function getEditorForce(id: string): Promise<EditorMapForce> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    return mapForceRow(await getEditorEntityRow<EditorForceRow>(client, FORCE_CONFIG, id));
  } finally {
    client.release();
  }
}

export async function createEditorForce(
  input: EditorMapForceInput,
  userId: number,
): Promise<EditorMapForce> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await createEditorEntity<EditorForceRow>(client, FORCE_CONFIG, input, userId);
    await client.query("COMMIT");
    return mapForceRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEditorForce(
  id: string,
  input: EditorMapForcePatch,
  userId: number,
): Promise<EditorMapForce> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await updateEditorEntity<EditorForceRow>(client, FORCE_CONFIG, id, input, userId);
    await client.query("COMMIT");
    return mapForceRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEditorForce(id: string): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await deleteEditorEntity(client, FORCE_CONFIG, id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listEditorRoutes(options?: EditorListOptions): Promise<EditorMapRoute[]> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    const query = buildRouteListQuery(options);
    const result = await client.query<EditorRouteRow>(query.sql, query.values);
    return result.rows.map(mapRouteRow);
  } finally {
    client.release();
  }
}

export async function getEditorRoute(id: string): Promise<EditorMapRoute> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    return mapRouteRow(await getEditorRouteRow(client, id));
  } finally {
    client.release();
  }
}

export async function createEditorRoute(
  input: EditorMapRouteInput,
  userId: number,
): Promise<EditorMapRoute> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await createEditorRouteInternal(client, input, userId);
    await client.query("COMMIT");
    return mapRouteRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEditorRoute(
  id: string,
  input: EditorMapRoutePatch,
  userId: number,
): Promise<EditorMapRoute> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const row = await updateEditorRouteInternal(client, id, input, userId);
    await client.query("COMMIT");
    return mapRouteRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEditorRoute(id: string): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();
  if (!hasDatabase) throw new Error("La base de donnees n'est pas configuree.");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await deleteEditorRouteInternal(client, id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
