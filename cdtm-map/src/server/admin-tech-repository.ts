import type { PoolClient, QueryResultRow } from "pg";

import {
  getTechTableDefinition,
  techTableDefinitions,
  type TechFieldDefinition,
  type TechTableDefinition,
  type TechTableKey,
  type TechTableRow,
  type TechTableRowValue,
  type TechTableRowsResponse,
  type TechTableStatus,
} from "@/admin/tech-types";
import { ensureDatabaseReady, getPool } from "@/server/db";

const DEFAULT_TABLE_LIMIT = 100;
const MAX_TABLE_LIMIT = 250;

function assertTechTableDefinition(key: string): TechTableDefinition {
  const definition = getTechTableDefinition(key);

  if (!definition) {
    throw new Error(`Table technique inconnue: ${key}`);
  }

  return definition;
}

function normalizeLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_TABLE_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_TABLE_LIMIT);
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Valeur texte invalide.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function normalizeFieldValue(field: TechFieldDefinition, value: unknown): TechTableRowValue {
  switch (field.type) {
    case "integer":
      return normalizeInteger(value);
    case "boolean":
      return normalizeBoolean(value);
    case "datetime":
      return normalizeDateTime(value);
    case "text":
    case "textarea":
      return normalizeNullableString(value);
    default:
      return null;
  }
}

function toSerializableValue(value: unknown): TechTableRowValue {
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

function mapRow(definition: TechTableDefinition, row: QueryResultRow): TechTableRow {
  return Object.fromEntries(
    definition.fields.map((field) => [field.name, toSerializableValue(row[field.name])]),
  );
}

async function ensureRegistryCaseExists(client: PoolClient, idCase: string): Promise<void> {
  const result = await client.query<{ id_case: string }>(
    `
      SELECT id_case
      FROM case_registry
      WHERE id_case = $1
    `,
    [idCase],
  );

  if (result.rowCount === 0) {
    throw new Error(`La case ${idCase} est introuvable dans case_registry.`);
  }
}

function getSearchColumns(definition: TechTableDefinition): string[] {
  return definition.fields.filter((field) => field.searchable).map((field) => field.name);
}

async function queryTableCount(
  client: PoolClient,
  definition: TechTableDefinition,
  search: string,
): Promise<number> {
  const searchColumns = getSearchColumns(definition);

  if (!search || searchColumns.length === 0) {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${definition.physical_name}`,
    );

    return Number.parseInt(result.rows[0]?.count ?? "0", 10);
  }

  const likeValue = `%${search}%`;
  const searchClauses = searchColumns.map(
    (columnName, index) => `COALESCE(${columnName}::text, '') ILIKE $${index + 1}`,
  );
  const values = searchColumns.map(() => likeValue);
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM ${definition.physical_name}
      WHERE ${searchClauses.join(" OR ")}
    `,
    values,
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

function buildTableSelectQuery(
  definition: TechTableDefinition,
  search: string,
  limit: number,
): { sql: string; values: Array<string | number> } {
  const columns = definition.fields.map((field) => field.name).join(", ");
  const searchColumns = getSearchColumns(definition);

  if (!search || searchColumns.length === 0) {
    return {
      sql: `
        SELECT ${columns}
        FROM ${definition.physical_name}
        ORDER BY ${definition.primary_key} DESC
        LIMIT $1
      `,
      values: [limit],
    };
  }

  const likeValue = `%${search}%`;
  const searchClauses = searchColumns.map(
    (columnName, index) => `COALESCE(${columnName}::text, '') ILIKE $${index + 1}`,
  );

  return {
    sql: `
      SELECT ${columns}
      FROM ${definition.physical_name}
      WHERE ${searchClauses.join(" OR ")}
      ORDER BY ${definition.primary_key} DESC
      LIMIT $${searchColumns.length + 1}
    `,
    values: [...searchColumns.map(() => likeValue), limit],
  };
}

function getEditableFields(definition: TechTableDefinition): TechFieldDefinition[] {
  return definition.fields.filter((field) => !field.readOnly);
}

function getUpdatableFields(definition: TechTableDefinition): TechFieldDefinition[] {
  return getEditableFields(definition).filter((field) => field.name !== definition.primary_key);
}

async function validateCaseReferenceIfPresent(
  client: PoolClient,
  definition: TechTableDefinition,
  normalizedRow: TechTableRow,
): Promise<void> {
  if (!definition.fields.some((field) => field.name === "id_case")) {
    return;
  }

  const idCase = normalizedRow.id_case;

  if (typeof idCase === "string" && idCase.length > 0) {
    await ensureRegistryCaseExists(client, idCase);
  }
}

function normalizeRowInput(definition: TechTableDefinition, row: unknown): TechTableRow {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    throw new Error("Ligne technique invalide.");
  }

  const rawRow = row as Record<string, unknown>;
  const normalizedRow: TechTableRow = {};

  for (const field of getEditableFields(definition)) {
    const rawValue = rawRow[field.name];
    const normalizedValue = normalizeFieldValue(field, rawValue);

    if (field.required && (normalizedValue === null || normalizedValue === "")) {
      throw new Error(`Le champ ${field.name} est obligatoire.`);
    }

    normalizedRow[field.name] = normalizedValue;
  }

  return normalizedRow;
}

async function upsertTableRowInternal(
  client: PoolClient,
  definition: TechTableDefinition,
  row: unknown,
  userId: number,
): Promise<TechTableRow> {
  const normalizedRow = normalizeRowInput(definition, row);
  await validateCaseReferenceIfPresent(client, definition, normalizedRow);

  const primaryKeyField = definition.fields.find((field) => field.name === definition.primary_key);

  if (!primaryKeyField) {
    throw new Error(`Cle primaire introuvable pour ${definition.key}.`);
  }

  const primaryKeyValue = normalizedRow[definition.primary_key];
  const primaryKeyMissing =
    primaryKeyValue === null ||
    primaryKeyValue === "" ||
    typeof primaryKeyValue === "undefined";

  if (!definition.auto_primary_key && primaryKeyMissing) {
    throw new Error(`Le champ ${definition.primary_key} est obligatoire.`);
  }

  const updatableFields = getUpdatableFields(definition);
  const insertFields = getEditableFields(definition).filter((field) => {
    if (field.name === definition.primary_key && definition.auto_primary_key && primaryKeyMissing) {
      return false;
    }

    return true;
  });
  const insertColumns = [...insertFields.map((field) => field.name), "updated_by_user_id"];
  const insertValues = [...insertFields.map((field) => normalizedRow[field.name]), userId];
  const insertPlaceholders = insertValues.map((_, index) => `$${index + 1}`);
  const updateAssignments = [
    ...updatableFields.map((field) => `${field.name} = EXCLUDED.${field.name}`),
    "updated_by_user_id = EXCLUDED.updated_by_user_id",
    "updated_at = NOW()",
  ];

  const sql = definition.auto_primary_key && primaryKeyMissing
    ? `
        INSERT INTO ${definition.physical_name} (${insertColumns.join(", ")})
        VALUES (${insertPlaceholders.join(", ")})
        RETURNING ${definition.fields.map((field) => field.name).join(", ")}
      `
    : `
        INSERT INTO ${definition.physical_name} (${insertColumns.join(", ")})
        VALUES (${insertPlaceholders.join(", ")})
        ON CONFLICT (${definition.primary_key}) DO UPDATE
        SET ${updateAssignments.join(", ")}
        RETURNING ${definition.fields.map((field) => field.name).join(", ")}
      `;

  const result = await client.query(sql, insertValues);
  return mapRow(definition, result.rows[0]);
}

export async function listBusinessTableStatuses(): Promise<TechTableStatus[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    const statuses: TechTableStatus[] = [];

    for (const definition of techTableDefinitions) {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${definition.physical_name}`,
      );

      statuses.push({
        definition,
        row_count: Number.parseInt(result.rows[0]?.count ?? "0", 10),
      });
    }

    return statuses;
  } finally {
    client.release();
  }
}

export async function listBusinessTableRows(
  tableKey: TechTableKey,
  options?: { search?: string; limit?: number },
): Promise<TechTableRowsResponse> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const definition = assertTechTableDefinition(tableKey);
  const search = options?.search?.trim() ?? "";
  const limit = normalizeLimit(options?.limit);
  const client = await getPool().connect();

  try {
    const totalCount = await queryTableCount(client, definition, search);
    const { sql, values } = buildTableSelectQuery(definition, search, limit);
    const result = await client.query(sql, values);

    return {
      definition,
      rows: result.rows.map((row) => mapRow(definition, row)),
      total_count: totalCount,
      returned_count: result.rowCount ?? 0,
      search,
    };
  } finally {
    client.release();
  }
}

export async function saveBusinessTableRow(
  tableKey: TechTableKey,
  row: unknown,
  userId: number,
): Promise<TechTableRow> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const definition = assertTechTableDefinition(tableKey);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const savedRow = await upsertTableRowInternal(client, definition, row, userId);
    await client.query("COMMIT");
    return savedRow;
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

export async function deleteBusinessTableRow(
  tableKey: TechTableKey,
  primaryKeyValue: string,
): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const definition = assertTechTableDefinition(tableKey);
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
