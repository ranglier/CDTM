import type { PoolClient, QueryResultRow } from "pg";

import type {
  AdminBlockMeta,
  AdminCaseDraft,
  AdminDynamicFieldDefinition,
  AdminDynamicFieldValue,
  AdminDynamicSectionRecord,
  AdminReferenceData,
} from "@/admin/types";
import {
  getReferenceTableDefinition,
  referenceTableDefinitions,
  type AdminStyleUpsertInput,
  type DynamicCaseTableCreateInput,
  type DynamicCaseTableCreateResult,
  type DynamicCaseTableDefinition,
  type DynamicCaseTableFieldCreateInput,
  type DynamicCaseTableFieldCreateResult,
  type DynamicCaseTableFieldDefinition,
  type DynamicCaseTableSummary,
  type DynamicCaseTableUpdateInput,
  type ReferenceOption,
  type ReferenceTableDefinition,
  type ReferenceTableKey,
  type ReferenceTableRow,
  type ReferenceTableRowValue,
  type ReferenceTableRowsResponse,
  type ReferenceTableStatus,
  type ReferenceStyleValue,
  type TechFieldDefinition,
} from "@/admin/tech-types";
import {
  createEmptyPublicMapStyles,
  normalizeHexColor,
  normalizePatternType,
  type MapStyleRecord,
  type MapPatternType,
  type MapStyleTargetType,
  type PublicMapStyles,
} from "@/map/types";
import { ensureDatabaseReady, getPool } from "@/server/db";

const DEFAULT_TABLE_LIMIT = 100;
const MAX_TABLE_LIMIT = 250;
const DYNAMIC_TABLE_PREFIX = "case_dynamic_";
const MAP_STYLE_TARGET_TYPES: MapStyleTargetType[] = [
  "faction",
  "controleur",
  "terrain_type",
  "relief",
];

function assertSafeSqlIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`SQL identifier invalide: ${identifier}`);
  }

  return `"${identifier}"`;
}

function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_TABLE_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_TABLE_LIMIT);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function isMapStyleTargetType(value: string): value is MapStyleTargetType {
  return MAP_STYLE_TARGET_TYPES.includes(value as MapStyleTargetType);
}

function normalizeMapStyleTargetType(value: unknown): MapStyleTargetType {
  const normalized = normalizeText(value);

  if (!isMapStyleTargetType(normalized)) {
    throw new Error("Type de cible de style invalide.");
  }

  return normalized;
}

function normalizeMapStyleTargetId(value: unknown): string {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new Error("Identifiant de cible de style obligatoire.");
  }

  return normalized;
}

function normalizeMapStylePayload(input: AdminStyleUpsertInput): {
  targetType: MapStyleTargetType;
  targetId: string;
  fill: string | null;
  stroke: string | null;
  patternType: MapPatternType | null;
  patternColor: string | null;
} {
  const targetType = normalizeMapStyleTargetType(input.target_type);
  const targetId = normalizeMapStyleTargetId(input.target_id);
  const fillRaw = normalizeNullableText(input.fill);
  const strokeRaw = normalizeNullableText(input.stroke);
  const patternTypeRaw = normalizeNullableText(input.pattern_type);
  const patternColorRaw = normalizeNullableText(input.pattern_color);

  if (input.fill !== undefined && input.fill !== null && input.fill !== "" && fillRaw === null) {
    throw new Error("Couleur de fond invalide.");
  }

  if (input.stroke !== undefined && input.stroke !== null && input.stroke !== "" && strokeRaw === null) {
    throw new Error("Couleur de contour invalide.");
  }

  const fill = fillRaw ? normalizeHexColor(fillRaw) : null;
  const stroke = strokeRaw ? normalizeHexColor(strokeRaw) : null;
  const patternType =
    patternTypeRaw && patternTypeRaw !== "none" ? normalizePatternType(patternTypeRaw) : null;
  const patternColor = patternType && patternColorRaw ? normalizeHexColor(patternColorRaw) : null;

  if (fillRaw && !fill) {
    throw new Error("Couleur de fond invalide.");
  }

  if (strokeRaw && !stroke) {
    throw new Error("Couleur de contour invalide.");
  }

  if (patternTypeRaw && patternTypeRaw !== "none" && !patternType) {
    throw new Error("Motif invalide.");
  }

  if (patternType && patternColorRaw && !patternColor) {
    throw new Error("Couleur du motif invalide.");
  }

  return {
    targetType,
    targetId,
    fill,
    stroke,
    patternType,
    patternColor,
  };
}

function sanitizeMapStyleRow(row: {
  cible_type: string | null;
  cible_id: string | null;
  fill: string | null;
  stroke: string | null;
  pattern_type: string | null;
  pattern_color: string | null;
}): MapStyleRecord | null {
  if (!row.cible_type || !row.cible_id || !isMapStyleTargetType(row.cible_type)) {
    return null;
  }

  const fill = row.fill ? normalizeHexColor(row.fill) : null;
  const stroke = row.stroke ? normalizeHexColor(row.stroke) : null;
  const patternType = row.pattern_type ? normalizePatternType(row.pattern_type) : null;
  const patternColor = row.pattern_color ? normalizeHexColor(row.pattern_color) : null;

  if (!fill && !stroke && !patternType && !patternColor) {
    return null;
  }

  return {
    target_type: row.cible_type,
    target_id: row.cible_id,
    fill,
    stroke,
    pattern_type: patternType,
    pattern_color: patternColor,
  };
}

function buildStyleId(targetType: MapStyleTargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

function getReferenceStyleTargetType(
  definition: ReferenceTableDefinition,
  groupKey: string | null = null,
): MapStyleTargetType | null {
  if (definition.key === "factions") {
    return "faction";
  }

  if (definition.key === "controleurs") {
    return "controleur";
  }

  if (definition.key === "nomenclatures") {
    const normalizedGroupKey = normalizeText(groupKey);

    if (normalizedGroupKey === "terrain_type" || normalizedGroupKey === "relief") {
      return normalizedGroupKey;
    }
  }

  return null;
}

async function listStylesForTargets(
  client: PoolClient,
  targetType: MapStyleTargetType,
  targetIds: string[],
): Promise<Record<string, ReferenceStyleValue>> {
  const uniqueTargetIds = Array.from(new Set(targetIds.filter((value) => value.trim().length > 0)));

  if (uniqueTargetIds.length === 0) {
    return {};
  }

  const result = await client.query<{
    cible_type: string | null;
    cible_id: string | null;
    fill: string | null;
    stroke: string | null;
    pattern_type: string | null;
    pattern_color: string | null;
  }>(
    `
      SELECT DISTINCT ON (cible_type, cible_id)
        cible_type,
        cible_id,
        fill,
        stroke,
        pattern_type,
        pattern_color
      FROM reference_styles
      WHERE cible_type = $1
        AND cible_id = ANY($2::text[])
      ORDER BY cible_type, cible_id, updated_at DESC, created_at DESC
    `,
    [targetType, uniqueTargetIds],
  );

  return Object.fromEntries(
    result.rows
      .map((row) => sanitizeMapStyleRow(row))
      .filter((row): row is MapStyleRecord => row !== null)
      .map((row) => [
        row.target_id,
        {
          fill: row.fill,
          stroke: row.stroke,
          pattern_type: row.pattern_type,
          pattern_color: row.pattern_color,
        },
      ]),
  );
}

function normalizeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  throw new Error("Valeur numerique invalide.");
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error("Valeur numerique invalide.");
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  throw new Error("Valeur booleenne invalide.");
}

function normalizeDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Valeur de date invalide.");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Valeur de date invalide.");
  }

  return parsed.toISOString();
}

function normalizeImagePath(value: unknown): string | null {
  const normalized = normalizeNullableText(value);

  if (!normalized) {
    return null;
  }

  if (/^\/uploads\/map-icons\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized)) {
    return normalized;
  }

  throw new Error("Chemin d'image invalide.");
}

function normalizeFieldValue(field: TechFieldDefinition, value: unknown): ReferenceTableRowValue {
  if (field.name === "image_path") {
    return normalizeImagePath(value);
  }

  switch (field.type) {
    case "integer":
      return normalizeInteger(value);
    case "number":
      return normalizeNumber(value);
    case "boolean":
      return normalizeBoolean(value);
    case "datetime":
      return normalizeDateTime(value);
    case "reference":
    case "text":
    case "textarea":
      return normalizeNullableText(value);
    default:
      return null;
  }
}

function toSerializableValue(value: unknown): ReferenceTableRowValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function mapReferenceRow(definition: ReferenceTableDefinition, row: QueryResultRow): ReferenceTableRow {
  return Object.fromEntries(
    definition.fields.map((field) => [field.name, toSerializableValue(row[field.name])]),
  );
}

function ensurePlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Corps invalide.");
  }

  return value as Record<string, unknown>;
}

function getSearchColumns(definition: ReferenceTableDefinition): string[] {
  return definition.fields.filter((field) => field.searchable).map((field) => field.name);
}

function getEditableFields(definition: ReferenceTableDefinition): TechFieldDefinition[] {
  return definition.fields.filter((field) => !field.readOnly);
}

function normalizeReferenceRowInput(
  definition: ReferenceTableDefinition,
  row: unknown,
): ReferenceTableRow {
  const payload = ensurePlainObject(row);
  const normalizedRow: ReferenceTableRow = {};

  for (const field of getEditableFields(definition)) {
    const normalizedValue = normalizeFieldValue(field, payload[field.name]);

    if (field.required && (normalizedValue === null || normalizedValue === "")) {
      throw new Error(`Le champ ${field.name} est obligatoire.`);
    }

    normalizedRow[field.name] = normalizedValue;
  }

  return normalizedRow;
}

async function queryReferenceTableCount(
  client: PoolClient,
  definition: ReferenceTableDefinition,
  search: string,
  groupKey: string | null = null,
): Promise<number> {
  const searchColumns = getSearchColumns(definition);
  const normalizedGroupKey =
    definition.key === "nomenclatures" ? normalizeNullableText(groupKey) : null;

  if ((!search || searchColumns.length === 0) && !normalizedGroupKey) {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${definition.physical_name}`,
    );

    return Number.parseInt(result.rows[0]?.count ?? "0", 10);
  }

  const whereClauses: string[] = [];
  const values: Array<string | number> = [];

  if (normalizedGroupKey) {
    values.push(normalizedGroupKey);
    whereClauses.push(`group_key = $${values.length}`);
  }

  if (search && searchColumns.length > 0) {
    const likeValue = `%${search}%`;
    const searchValueIndexes = searchColumns.map((_, index) => `$${values.length + index + 1}`);
    values.push(...searchColumns.map(() => likeValue));
    whereClauses.push(
      `(${searchColumns
        .map((columnName, index) => `COALESCE(${columnName}::text, '') ILIKE ${searchValueIndexes[index]}`)
        .join(" OR ")})`,
    );
  }

  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM ${definition.physical_name}
      WHERE ${whereClauses.join(" AND ")}
    `,
    values,
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

function buildReferenceTableQuery(
  definition: ReferenceTableDefinition,
  search: string,
  limit: number,
  groupKey: string | null = null,
): { sql: string; values: Array<string | number> } {
  const columns = definition.fields.map((field) => `ref.${field.name}`).join(", ");
  const searchColumns = getSearchColumns(definition);
  const normalizedGroupKey =
    definition.key === "nomenclatures" ? normalizeNullableText(groupKey) : null;

  const orderBy = (() => {
    switch (definition.key) {
      case "nomenclatures":
        return "LOWER(COALESCE(ref.label, ref.entry_key)) ASC, ref.entry_key ASC";
      case "factions":
        return "LOWER(COALESCE(ref.nom, ref.id_faction)) ASC, ref.id_faction ASC";
      case "controleurs":
        return "LOWER(COALESCE(ref.nom, ref.id_controleur)) ASC, ref.id_controleur ASC";
      case "map_icons":
        return "LOWER(COALESCE(ref.label, ref.icon_key)) ASC, ref.icon_key ASC";
      case "locality_types":
      case "landmark_types":
      case "force_types":
        return "LOWER(COALESCE(ref.label, ref.type_key)) ASC, ref.type_key ASC";
      case "races":
        return "LOWER(COALESCE(ref.label, ref.race_key)) ASC, ref.race_key ASC";
      case "peuples":
        return "LOWER(COALESCE(ref.label, ref.peuple_key)) ASC, ref.peuple_key ASC";
      default:
        return `ref.${definition.primary_key} ASC`;
    }
  })();

  if ((!search || searchColumns.length === 0) && !normalizedGroupKey) {
    return {
      sql: `
        SELECT ${columns}, staff_users.username AS updated_by_username
        FROM ${definition.physical_name} AS ref
        LEFT JOIN staff_users ON staff_users.id = ref.updated_by_user_id
        ORDER BY ${orderBy}
        LIMIT $1
      `,
      values: [limit],
    };
  }

  const whereClauses: string[] = [];
  const values: Array<string | number> = [];

  if (normalizedGroupKey) {
    values.push(normalizedGroupKey);
    whereClauses.push(`ref.group_key = $${values.length}`);
  }

  if (search && searchColumns.length > 0) {
    const likeValue = `%${search}%`;
    const searchValueIndexes = searchColumns.map((_, index) => `$${values.length + index + 1}`);
    values.push(...searchColumns.map(() => likeValue));
    whereClauses.push(
      `(${searchColumns
        .map((columnName, index) => `COALESCE(ref.${columnName}::text, '') ILIKE ${searchValueIndexes[index]}`)
        .join(" OR ")})`,
    );
  }

  return {
    sql: `
      SELECT ${columns}, staff_users.username AS updated_by_username
      FROM ${definition.physical_name} AS ref
      LEFT JOIN staff_users ON staff_users.id = ref.updated_by_user_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${values.length + 1}
    `,
    values: [...values, limit],
  };
}

function assertReferenceTableDefinition(tableKey: string): ReferenceTableDefinition {
  const definition = getReferenceTableDefinition(tableKey);

  if (!definition) {
    throw new Error(`Table de reference inconnue: ${tableKey}`);
  }

  return definition;
}

function validateDynamicTableKey(tableKey: string): string {
  const normalized = normalizeText(tableKey);

  if (!/^[a-z][a-z0-9_]{1,40}$/.test(normalized)) {
    throw new Error("Le nom logique de table doit etre en snake_case simple.");
  }

  return normalized;
}

function validateDynamicFieldKey(fieldKey: string): string {
  const normalized = normalizeText(fieldKey);

  if (!/^[a-z][a-z0-9_]{1,40}$/.test(normalized)) {
    throw new Error("Le nom de champ doit etre en snake_case simple.");
  }

  if (["id_case", "updated_by_user_id", "created_at", "updated_at"].includes(normalized)) {
    throw new Error("Ce nom de champ est reserve.");
  }

  return normalized;
}

function buildDynamicPhysicalName(tableKey: string): string {
  const physicalName = `${DYNAMIC_TABLE_PREFIX}${tableKey}`;

  if (physicalName.length > 55) {
    throw new Error("Le nom physique de table est trop long.");
  }

  return physicalName;
}

function getDynamicSqlType(fieldType: DynamicCaseTableFieldDefinition["field_type"]): string {
  switch (fieldType) {
    case "boolean":
      return "BOOLEAN";
    case "integer":
      return "INTEGER";
    case "datetime":
      return "TIMESTAMPTZ";
    case "reference":
    case "text":
    case "textarea":
      return "TEXT";
    default:
      return "TEXT";
  }
}

function toDynamicFieldValue(value: unknown): AdminDynamicFieldValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toIsoStringOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }

  return new Date(String(value)).toISOString();
}

async function selectDynamicCaseTableDefinition(
  client: PoolClient,
  tableKey: string,
): Promise<DynamicCaseTableDefinition | null> {
  const tableResult = await client.query<{
    table_key: string;
    physical_name: string;
    title: string;
    description: string | null;
    is_active: boolean;
  }>(
    `
      SELECT table_key, physical_name, title, description, is_active
      FROM dynamic_case_tables
      WHERE table_key = $1
      LIMIT 1
    `,
    [tableKey],
  );

  const table = tableResult.rows[0];

  if (!table) {
    return null;
  }

  const fieldResult = await client.query<DynamicCaseTableFieldDefinition>(
    `
      SELECT
        field_key,
        label,
        field_type,
        reference_table_key,
        reference_group_key
      FROM dynamic_case_table_fields
      WHERE table_key = $1
      ORDER BY LOWER(label) ASC, field_key ASC
    `,
    [tableKey],
  );

  return {
    table_key: table.table_key,
    physical_name: table.physical_name,
    title: table.title,
    description: table.description,
    is_active: table.is_active,
    fields: fieldResult.rows,
  };
}

async function listDynamicCaseTableDefinitionsInternal(
  client: PoolClient,
): Promise<DynamicCaseTableDefinition[]> {
  const tablesResult = await client.query<{
    table_key: string;
    physical_name: string;
    title: string;
    description: string | null;
    is_active: boolean;
  }>(
    `
      SELECT table_key, physical_name, title, description, is_active
      FROM dynamic_case_tables
      ORDER BY title ASC, table_key ASC
    `,
  );

  const definitions: DynamicCaseTableDefinition[] = [];

  for (const table of tablesResult.rows) {
    const definition = await selectDynamicCaseTableDefinition(client, table.table_key);

    if (definition) {
      definitions.push(definition);
    }
  }

  return definitions;
}

async function listReferenceOptionsInternal(
  client: PoolClient,
  tableKey: ReferenceTableKey,
  groupKey: string | null = null,
): Promise<ReferenceOption[]> {
  switch (tableKey) {
    case "nomenclatures": {
      const normalizedGroupKey = normalizeText(groupKey);

      if (!normalizedGroupKey) {
        return [];
      }

      const result = await client.query<{
        entry_key: string;
        label: string | null;
      }>(
        `
          SELECT entry_key, label
          FROM reference_nomenclature_values
          WHERE group_key = $1
          ORDER BY LOWER(COALESCE(label, entry_key)) ASC, entry_key ASC
        `,
        [normalizedGroupKey],
      );

      return result.rows.map((row) => ({
        value: row.entry_key,
        label: row.label?.trim().length ? row.label : row.entry_key,
      }));
    }
    case "factions": {
      const result = await client.query<{ id_faction: string; nom: string | null }>(
        `
          SELECT id_faction, nom
          FROM reference_factions
          ORDER BY LOWER(COALESCE(nom, id_faction)) ASC, id_faction ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.id_faction,
        label: row.nom?.trim().length ? row.nom : row.id_faction,
      }));
    }
    case "controleurs": {
      const result = await client.query<{ id_controleur: string; nom: string | null }>(
        `
          SELECT id_controleur, nom
          FROM reference_controleurs
          ORDER BY LOWER(COALESCE(nom, id_controleur)) ASC, id_controleur ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.id_controleur,
        label: row.nom?.trim().length ? row.nom : row.id_controleur,
      }));
    }
    case "styles": {
      const result = await client.query<{ id_style: string; cible_id: string | null }>(
        `
          SELECT id_style, cible_id
          FROM reference_styles
          ORDER BY id_style ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.id_style,
        label: row.cible_id?.trim().length ? row.cible_id : row.id_style,
      }));
    }
    case "map_icons": {
      const result = await client.query<{ icon_key: string; label: string | null }>(
        `
          SELECT icon_key, label
          FROM reference_map_icons
          WHERE is_active = TRUE
          ORDER BY LOWER(COALESCE(label, icon_key)) ASC, icon_key ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.icon_key,
        label: row.label?.trim().length ? row.label : row.icon_key,
      }));
    }
    case "locality_types":
    case "landmark_types":
    case "force_types": {
      const tableName =
        tableKey === "locality_types"
          ? "reference_locality_types"
          : tableKey === "landmark_types"
            ? "reference_landmark_types"
            : "reference_force_types";
      const result = await client.query<{ type_key: string; label: string | null }>(
        `
          SELECT type_key, label
          FROM ${tableName}
          WHERE is_active = TRUE
          ORDER BY LOWER(COALESCE(label, type_key)) ASC, type_key ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.type_key,
        label: row.label?.trim().length ? row.label : row.type_key,
      }));
    }
    case "races": {
      const result = await client.query<{ race_key: string; label: string | null }>(
        `
          SELECT race_key, label
          FROM reference_races
          WHERE is_active = TRUE
          ORDER BY LOWER(COALESCE(label, race_key)) ASC, race_key ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.race_key,
        label: row.label?.trim().length ? row.label : row.race_key,
      }));
    }
    case "peuples": {
      const result = await client.query<{ peuple_key: string; label: string | null }>(
        `
          SELECT peuple_key, label
          FROM reference_peuples
          WHERE is_active = TRUE
          ORDER BY LOWER(COALESCE(label, peuple_key)) ASC, peuple_key ASC
        `,
      );

      return result.rows.map((row) => ({
        value: row.peuple_key,
        label: row.label?.trim().length ? row.label : row.peuple_key,
      }));
    }
    default:
      return [];
  }
}

async function getReferenceFieldOptions(
  client: PoolClient,
  definition: ReferenceTableDefinition,
): Promise<Record<string, ReferenceOption[]>> {
  const entries = await Promise.all(
    definition.fields
      .filter((field) => field.reference_table_key)
      .map(async (field) => [
        field.name,
        await listReferenceOptionsInternal(
          client,
          field.reference_table_key as ReferenceTableKey,
          field.reference_group_key ?? null,
        ),
      ] as const),
  );

  return Object.fromEntries(entries);
}

function isAllowedOption(options: ReferenceOption[], value: string | null): boolean {
  if (!value) {
    return true;
  }

  return options.some((option) => option.value === value);
}

export async function getStaticAdminReferenceData(
  clientArg?: PoolClient,
): Promise<AdminReferenceData> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = clientArg ?? (await getPool().connect());

  try {
    const [
      terrainCategories,
      terrainTypeRows,
      reliefOptions,
      factionOptions,
      controllerOptions,
      controlTypeOptions,
    ] =
      await Promise.all([
        listReferenceOptionsInternal(client, "nomenclatures", "terrain_cat"),
        client.query<{
          entry_key: string;
          label: string | null;
          parent_entry_key: string | null;
        }>(
          `
            SELECT entry_key, label, parent_entry_key
            FROM reference_nomenclature_values
            WHERE group_key = 'terrain_type'
            ORDER BY LOWER(COALESCE(label, entry_key)) ASC, entry_key ASC
          `,
        ),
        listReferenceOptionsInternal(client, "nomenclatures", "relief"),
        listReferenceOptionsInternal(client, "factions"),
        listReferenceOptionsInternal(client, "controleurs"),
        listReferenceOptionsInternal(client, "nomenclatures", "controle_type"),
      ]);

    const terrainTypesByCategory: Record<string, ReferenceOption[]> = {};

    for (const row of terrainTypeRows.rows) {
      const categoryKey = row.parent_entry_key ?? "default";

      if (!terrainTypesByCategory[categoryKey]) {
        terrainTypesByCategory[categoryKey] = [];
      }

      terrainTypesByCategory[categoryKey].push({
        value: row.entry_key,
        label: row.label?.trim().length ? row.label : row.entry_key,
      });
    }

    return {
      terrain_categories: terrainCategories,
      terrain_types_by_category: terrainTypesByCategory,
      relief_options: reliefOptions,
      faction_options: factionOptions,
      controller_options: controllerOptions,
      control_type_options: controlTypeOptions,
    };
  } finally {
    if (!clientArg) {
      client.release();
    }
  }
}

export async function listReferenceTableStatuses(): Promise<ReferenceTableStatus[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    const statuses: ReferenceTableStatus[] = [];

    for (const definition of referenceTableDefinitions) {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${definition.physical_name}`,
      );

      const baseStatus: ReferenceTableStatus = {
        definition,
        row_count: Number.parseInt(result.rows[0]?.count ?? "0", 10),
      };

      if (definition.key === "nomenclatures") {
        const groupsResult = await client.query<{ group_key: string; row_count: string }>(
          `
            SELECT group_key, COUNT(*)::text AS row_count
            FROM reference_nomenclature_values
            GROUP BY group_key
            ORDER BY group_key ASC
          `,
        );

        baseStatus.group_counts = groupsResult.rows.map((row) => ({
          group_key: row.group_key,
          row_count: Number.parseInt(row.row_count, 10),
        }));
      }

      statuses.push(baseStatus);
    }

    return statuses;
  } finally {
    client.release();
  }
}

export async function listReferenceTableRows(
  tableKey: ReferenceTableKey,
  options?: { search?: string; limit?: number; groupKey?: string | null },
): Promise<ReferenceTableRowsResponse> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const definition = assertReferenceTableDefinition(tableKey);
  const search = options?.search?.trim() ?? "";
  const limit = normalizeLimit(options?.limit);
  const groupKey = definition.key === "nomenclatures" ? normalizeNullableText(options?.groupKey) : null;
  const client = await getPool().connect();

  try {
    const totalCount = await queryReferenceTableCount(client, definition, search, groupKey);
    const { sql, values } = buildReferenceTableQuery(definition, search, limit, groupKey);
    const result = await client.query(sql, values);
    const styleTargetType = getReferenceStyleTargetType(definition, groupKey);
    const styleTargetIdField =
      styleTargetType === "faction"
        ? "id_faction"
        : styleTargetType === "controleur"
          ? "id_controleur"
          : styleTargetType
            ? "entry_key"
            : null;
    const styles =
      styleTargetType && styleTargetIdField
        ? await listStylesForTargets(
            client,
            styleTargetType,
            result.rows
              .map((row) => {
                const value = row[styleTargetIdField];
                return typeof value === "string" ? value : null;
              })
              .filter((value): value is string => Boolean(value)),
          )
        : undefined;
    const fieldOptions = await getReferenceFieldOptions(client, definition);

    return {
      definition,
      rows: result.rows.map((row) => mapReferenceRow(definition, row)),
      total_count: totalCount,
      returned_count: result.rowCount ?? 0,
      search,
      field_options: fieldOptions,
      style_target_type: styleTargetType,
      styles,
    };
  } finally {
    client.release();
  }
}

export async function saveMapStyle(
  input: AdminStyleUpsertInput,
  userId: number,
): Promise<MapStyleRecord | null> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const normalized = normalizeMapStylePayload(input);
  const client = await getPool().connect();

  try {
    if (!normalized.fill && !normalized.stroke && !normalized.patternType && !normalized.patternColor) {
      await client.query(
        `
          DELETE FROM reference_styles
          WHERE cible_type = $1
            AND cible_id = $2
        `,
        [normalized.targetType, normalized.targetId],
      );

      return null;
    }

    const stableStyleId = buildStyleId(normalized.targetType, normalized.targetId);

    await client.query(
      `
        DELETE FROM reference_styles
        WHERE cible_type = $1
          AND cible_id = $2
          AND id_style <> $3
      `,
      [normalized.targetType, normalized.targetId, stableStyleId],
    );

    const result = await client.query<{
      cible_type: string | null;
      cible_id: string | null;
      fill: string | null;
      stroke: string | null;
      pattern_type: string | null;
      pattern_color: string | null;
    }>(
      `
        INSERT INTO reference_styles (
          id_style,
          cible_type,
          cible_id,
          fill,
          stroke,
          pattern_type,
          pattern_color,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id_style) DO UPDATE
        SET
          cible_type = EXCLUDED.cible_type,
          cible_id = EXCLUDED.cible_id,
          fill = EXCLUDED.fill,
          stroke = EXCLUDED.stroke,
          pattern_type = EXCLUDED.pattern_type,
          pattern_color = EXCLUDED.pattern_color,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
        RETURNING cible_type, cible_id, fill, stroke, pattern_type, pattern_color
      `,
      [
        stableStyleId,
        normalized.targetType,
        normalized.targetId,
        normalized.fill,
        normalized.stroke,
        normalized.patternType,
        normalized.patternColor,
        userId,
      ],
    );

    return sanitizeMapStyleRow(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function listPublicMapStyles(): Promise<PublicMapStyles> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return createEmptyPublicMapStyles();
  }

  const result = await getPool().query<{
    cible_type: string | null;
    cible_id: string | null;
    fill: string | null;
    stroke: string | null;
    pattern_type: string | null;
    pattern_color: string | null;
  }>(
    `
      SELECT DISTINCT ON (cible_type, cible_id)
        cible_type,
        cible_id,
        fill,
        stroke,
        pattern_type,
        pattern_color
      FROM reference_styles
      WHERE cible_type = ANY($1::text[])
      ORDER BY cible_type, cible_id, updated_at DESC, created_at DESC
    `,
    [MAP_STYLE_TARGET_TYPES],
  );

  const styles = createEmptyPublicMapStyles();

  for (const row of result.rows) {
    const sanitized = sanitizeMapStyleRow(row);

    if (!sanitized) {
      continue;
    }

    styles[sanitized.target_type][sanitized.target_id] = sanitized;
  }

  return styles;
}

export async function saveReferenceTableRow(
  tableKey: ReferenceTableKey,
  row: unknown,
  userId: number,
): Promise<ReferenceTableRow> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const definition = assertReferenceTableDefinition(tableKey);
  const normalizedRow = normalizeReferenceRowInput(definition, row);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const editableFields = getEditableFields(definition);
    const columnNames = editableFields.map((field) => field.name);
    const insertColumns = [...columnNames, "updated_by_user_id"];
    const insertValues = columnNames.map((columnName) => normalizedRow[columnName]);
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
    const assignments = [
      ...columnNames
        .filter((columnName) => columnName !== definition.primary_key)
        .map((columnName) => `${columnName} = EXCLUDED.${columnName}`),
      "updated_by_user_id = EXCLUDED.updated_by_user_id",
      "updated_at = NOW()",
    ];

    const result = await client.query(
      `
        INSERT INTO ${definition.physical_name} (${insertColumns.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT (${definition.primary_key}) DO UPDATE
        SET ${assignments.join(", ")}
        RETURNING ${definition.fields.map((field) => field.name).join(", ")}
      `,
      [...insertValues, userId],
    );

    const savedRow = mapReferenceRow(definition, result.rows[0]);
    const userResult = await client.query<{ username: string | null }>(
      `
        SELECT username
        FROM staff_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    await client.query("COMMIT");
    return {
      ...savedRow,
      updated_by_username: userResult.rows[0]?.username ?? null,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new Error("La cle primaire ou une valeur unique est deja utilisee.");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function deleteReferenceTableRow(
  tableKey: ReferenceTableKey,
  primaryKeyValue: string,
): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const definition = assertReferenceTableDefinition(tableKey);
  const client = await getPool().connect();

  try {
    await client.query(
      `
        DELETE FROM ${definition.physical_name}
        WHERE ${definition.primary_key}::text = $1
      `,
      [primaryKeyValue],
    );
  } finally {
    client.release();
  }
}

export async function listDynamicCaseTableSummaries(): Promise<DynamicCaseTableSummary[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    const result = await client.query<DynamicCaseTableSummary>(
      `
        SELECT
          tables.table_key,
          tables.physical_name,
          tables.title,
          tables.description,
          tables.is_active,
          COUNT(fields.field_key)::int AS field_count
        FROM dynamic_case_tables AS tables
        LEFT JOIN dynamic_case_table_fields AS fields
          ON fields.table_key = tables.table_key
        GROUP BY tables.table_key, tables.physical_name, tables.title, tables.description, tables.is_active
        ORDER BY tables.title ASC, tables.table_key ASC
      `,
    );

    return result.rows;
  } finally {
    client.release();
  }
}

export async function getDynamicCaseTableDefinition(
  tableKey: string,
): Promise<DynamicCaseTableDefinition | null> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    return await selectDynamicCaseTableDefinition(client, tableKey);
  } finally {
    client.release();
  }
}

export async function createDynamicCaseTable(
  input: DynamicCaseTableCreateInput,
  userId: number,
): Promise<DynamicCaseTableCreateResult> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const tableKey = validateDynamicTableKey(input.table_key);
  const title = normalizeText(input.title);
  const description = normalizeNullableText(input.description);

  if (!title) {
    throw new Error("Le titre de table est obligatoire.");
  }

  const physicalName = buildDynamicPhysicalName(tableKey);
  const sqlTableName = assertSafeSqlIdentifier(physicalName);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO dynamic_case_tables (
          table_key,
          physical_name,
          title,
          description,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [tableKey, physicalName, title, description, userId],
    );

    await client.query(
      `
        CREATE TABLE ${sqlTableName} (
          id_case TEXT PRIMARY KEY REFERENCES case_registry(id_case) ON DELETE CASCADE,
          updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
    );

    const insertedRows = await client.query<{ count: string }>(
      `
        WITH inserted AS (
          INSERT INTO ${sqlTableName} (id_case)
          SELECT id_case
          FROM case_registry
          ON CONFLICT (id_case) DO NOTHING
          RETURNING id_case
        )
        SELECT COUNT(*)::text AS count
        FROM inserted
      `,
    );

    const definition = await selectDynamicCaseTableDefinition(client, tableKey);

    if (!definition) {
      throw new Error("Creation de table incomplete.");
    }

    await client.query("COMMIT");

    return {
      definition,
      provisioned_case_rows: Number.parseInt(insertedRows.rows[0]?.count ?? "0", 10),
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new Error("Une table metier avec ce nom existe deja.");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updateDynamicCaseTable(
  tableKey: string,
  input: DynamicCaseTableUpdateInput,
  userId: number,
): Promise<DynamicCaseTableDefinition> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    const current = await selectDynamicCaseTableDefinition(client, tableKey);

    if (!current) {
      throw new Error(`Table metier inconnue: ${tableKey}`);
    }

    const nextTitle =
      typeof input.title === "string" ? normalizeText(input.title) || current.title : current.title;
    const nextDescription =
      typeof input.description === "string"
        ? normalizeNullableText(input.description)
        : input.description === null
          ? null
          : current.description;
    const nextActive =
      typeof input.is_active === "boolean" ? input.is_active : current.is_active;

    await client.query(
      `
        UPDATE dynamic_case_tables
        SET
          title = $2,
          description = $3,
          is_active = $4,
          updated_by_user_id = $5,
          updated_at = NOW()
        WHERE table_key = $1
      `,
      [tableKey, nextTitle, nextDescription, nextActive, userId],
    );

    const updated = await selectDynamicCaseTableDefinition(client, tableKey);

    if (!updated) {
      throw new Error("Mise a jour de table impossible.");
    }

    return updated;
  } finally {
    client.release();
  }
}

export async function addDynamicCaseTableField(
  tableKey: string,
  input: DynamicCaseTableFieldCreateInput,
  userId: number,
): Promise<DynamicCaseTableFieldCreateResult> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const fieldKey = validateDynamicFieldKey(input.field_key);
  const label = normalizeText(input.label);

  if (!label) {
    throw new Error("Le libelle du champ est obligatoire.");
  }

  if (
    input.field_type === "reference" &&
    (!input.reference_table_key ||
      (input.reference_table_key === "nomenclatures" &&
        !normalizeText(input.reference_group_key ?? "")))
  ) {
    throw new Error("Un champ reference requiert une table globale cible.");
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const definition = await selectDynamicCaseTableDefinition(client, tableKey);

    if (!definition) {
      throw new Error(`Table metier inconnue: ${tableKey}`);
    }

    const sqlTableName = assertSafeSqlIdentifier(definition.physical_name);
    const sqlColumnName = assertSafeSqlIdentifier(fieldKey);

    await client.query(
      `
        ALTER TABLE ${sqlTableName}
        ADD COLUMN ${sqlColumnName} ${getDynamicSqlType(input.field_type)}
      `,
    );

    await client.query(
      `
        INSERT INTO dynamic_case_table_fields (
          table_key,
          field_key,
          label,
          field_type,
          reference_table_key,
          reference_group_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        tableKey,
        fieldKey,
        label,
        input.field_type,
        input.field_type === "reference" ? input.reference_table_key ?? null : null,
        input.field_type === "reference" ? normalizeNullableText(input.reference_group_key) : null,
      ],
    );

    await client.query(
      `
        UPDATE dynamic_case_tables
        SET updated_by_user_id = $2, updated_at = NOW()
        WHERE table_key = $1
      `,
      [tableKey, userId],
    );

    const nextDefinition = await selectDynamicCaseTableDefinition(client, tableKey);

    if (!nextDefinition) {
      throw new Error("Ajout de champ impossible.");
    }

    await client.query("COMMIT");

    return {
      definition: nextDefinition,
      added_field: nextDefinition.fields.find((field) => field.field_key === fieldKey)!,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "42701"
    ) {
      throw new Error("Ce champ existe deja dans la table.");
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new Error("Ce champ existe deja dans la table.");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function listDynamicCaseTableDefinitions(): Promise<DynamicCaseTableDefinition[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    return await listDynamicCaseTableDefinitionsInternal(client);
  } finally {
    client.release();
  }
}

export async function getDynamicCaseSectionsForCase(
  client: PoolClient,
  idCase: string,
): Promise<AdminDynamicSectionRecord[]> {
  const definitions = (await listDynamicCaseTableDefinitionsInternal(client)).filter(
    (definition) => definition.is_active,
  );
  const sections: AdminDynamicSectionRecord[] = [];

  for (const definition of definitions) {
    const tableName = assertSafeSqlIdentifier(definition.physical_name);
    const rowResult = await client.query<QueryResultRow>(
      `
        SELECT dynamic_row.*, staff_users.username AS updated_by
        FROM ${tableName} AS dynamic_row
        LEFT JOIN staff_users ON staff_users.id = dynamic_row.updated_by_user_id
        WHERE dynamic_row.id_case = $1
        LIMIT 1
      `,
      [idCase],
    );

    const row = rowResult.rows[0] ?? {};
    const fields: AdminDynamicFieldDefinition[] = [];

    for (const field of definition.fields) {
      const referenceOptions =
        field.field_type === "reference" && field.reference_table_key
          ? await listReferenceOptionsInternal(
              client,
              field.reference_table_key,
              field.reference_group_key,
            )
          : [];

      fields.push({
        ...field,
        reference_options: referenceOptions,
      });
    }

    const values = Object.fromEntries(
      definition.fields.map((field) => [
        field.field_key,
        toDynamicFieldValue(row[field.field_key]),
      ]),
    );

    const meta: AdminBlockMeta = {
      updated_at: toIsoStringOrNull(row.updated_at),
      updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    };

    sections.push({
      table_key: definition.table_key,
      title: definition.title,
      description: definition.description,
      fields,
      values,
      meta,
    });
  }

  return sections;
}

function normalizeDynamicDraftValue(
  field: DynamicCaseTableFieldDefinition,
  value: string | undefined,
): AdminDynamicFieldValue {
  switch (field.field_type) {
    case "boolean":
      return normalizeBoolean(value ?? "");
    case "integer":
      return normalizeInteger(value ?? "");
    case "datetime":
      return normalizeDateTime(value ?? "");
    case "reference":
    case "text":
    case "textarea":
      return normalizeNullableText(value ?? "");
    default:
      return normalizeNullableText(value ?? "");
  }
}

export async function saveDynamicSectionsForCase(
  client: PoolClient,
  idCase: string,
  dynamicDraft: AdminCaseDraft["dynamic"],
  userId: number,
): Promise<void> {
  const definitions = (await listDynamicCaseTableDefinitionsInternal(client)).filter(
    (definition) => definition.is_active,
  );

  for (const definition of definitions) {
    const sectionDraft = dynamicDraft[definition.table_key];

    if (!sectionDraft) {
      continue;
    }

    const normalizedValues: Array<AdminDynamicFieldValue> = [];
    const columnNames: string[] = [];

    for (const field of definition.fields) {
      const normalizedValue = normalizeDynamicDraftValue(field, sectionDraft[field.field_key]);

      if (
        field.field_type === "reference" &&
        field.reference_table_key &&
        !isAllowedOption(
          await listReferenceOptionsInternal(
            client,
            field.reference_table_key,
            field.reference_group_key,
          ),
          typeof normalizedValue === "string" ? normalizedValue : null,
        )
      ) {
        throw new Error(`La valeur du champ ${field.label} est invalide.`);
      }

      columnNames.push(field.field_key);
      normalizedValues.push(normalizedValue);
    }

    const sqlTableName = assertSafeSqlIdentifier(definition.physical_name);
    const insertColumns = ["id_case", ...columnNames, "updated_by_user_id"];
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
    const assignments = [
      ...columnNames.map((columnName) => `${columnName} = EXCLUDED.${columnName}`),
      "updated_by_user_id = EXCLUDED.updated_by_user_id",
      "updated_at = NOW()",
    ];

    await client.query(
      `
        INSERT INTO ${sqlTableName} (${insertColumns.join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT (id_case) DO UPDATE
        SET ${assignments.join(", ")}
      `,
      [idCase, ...normalizedValues, userId],
    );
  }
}

export async function validateStaticAdminDraftSelections(
  client: PoolClient,
  draft: AdminCaseDraft,
): Promise<void> {
  const referenceData = await getStaticAdminReferenceData(client);
  const terrainCategory = normalizeNullableText(draft.terrain.terrain_cat);
  const terrainType = normalizeNullableText(draft.terrain.terrain_type);
  const relief = normalizeNullableText(draft.terrain.relief);
  const faction = normalizeNullableText(draft.control.faction);
  const controleur = normalizeNullableText(draft.control.controleur);
  const controlType = normalizeNullableText(draft.control.controle_type);

  if (!isAllowedOption(referenceData.terrain_categories, terrainCategory)) {
    throw new Error("La valeur du champ terrain_cat est invalide.");
  }

  if (terrainType && !terrainCategory) {
    throw new Error("terrain_type requiert un terrain_cat.");
  }

  if (
    terrainType &&
    !isAllowedOption(referenceData.terrain_types_by_category[terrainCategory ?? ""] ?? [], terrainType)
  ) {
    throw new Error("La valeur du champ terrain_type est invalide.");
  }

  if (!isAllowedOption(referenceData.relief_options, relief)) {
    throw new Error("La valeur du champ relief est invalide.");
  }

  if (!isAllowedOption(referenceData.faction_options, faction)) {
    throw new Error("La valeur du champ faction est invalide.");
  }

  if (!isAllowedOption(referenceData.controller_options, controleur)) {
    throw new Error("La valeur du champ controleur est invalide.");
  }

  if (!isAllowedOption(referenceData.control_type_options, controlType)) {
    throw new Error("La valeur du champ controle_type est invalide.");
  }
}

export async function validateStaticBulkPatchSelections(
  client: PoolClient,
  patch: {
    terrain?: { terrain_cat?: string | null; terrain_type?: string | null; relief?: string | null };
    control?: { faction?: string | null; controleur?: string | null; controle_type?: string | null };
  },
): Promise<void> {
  const referenceData = await getStaticAdminReferenceData(client);

  if (patch.terrain?.terrain_cat !== undefined) {
    if (!isAllowedOption(referenceData.terrain_categories, patch.terrain.terrain_cat ?? null)) {
      throw new Error("La valeur du champ terrain_cat est invalide.");
    }
  }

  if (patch.terrain?.terrain_type !== undefined) {
    if (!patch.terrain.terrain_cat) {
      throw new Error("terrain_cat et terrain_type doivent etre modifies ensemble en edition de masse.");
    }

    if (
      !isAllowedOption(
        referenceData.terrain_types_by_category[patch.terrain.terrain_cat] ?? [],
        patch.terrain.terrain_type ?? null,
      )
    ) {
      throw new Error("La valeur du champ terrain_type est invalide.");
    }
  }

  if (patch.terrain?.relief !== undefined) {
    if (!isAllowedOption(referenceData.relief_options, patch.terrain.relief ?? null)) {
      throw new Error("La valeur du champ relief est invalide.");
    }
  }

  if (patch.control?.faction !== undefined) {
    if (!isAllowedOption(referenceData.faction_options, patch.control.faction ?? null)) {
      throw new Error("La valeur du champ faction est invalide.");
    }
  }

  if (patch.control?.controleur !== undefined) {
    if (!isAllowedOption(referenceData.controller_options, patch.control.controleur ?? null)) {
      throw new Error("La valeur du champ controleur est invalide.");
    }
  }

  if (patch.control?.controle_type !== undefined) {
    if (!isAllowedOption(referenceData.control_type_options, patch.control.controle_type ?? null)) {
      throw new Error("La valeur du champ controle_type est invalide.");
    }
  }
}
