import crypto from "node:crypto";

import type { PoolClient } from "pg";

import type {
  EditorListOptions,
  EditorMapForce,
  EditorMapForceInput,
  EditorMapLandmark,
  EditorMapLandmarkInput,
  EditorMapLocality,
  EditorMapLocalityInput,
  EditorReferenceData,
  EditorReferenceOption,
  MapObjectStatus,
} from "@/editor/types";
import { MAP_OBJECT_STATUSES } from "@/editor/types";
import { ensureDatabaseReady, getPool } from "@/server/db";

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

type EditorEntityConfig = {
  tableName: "map_localities" | "map_landmarks" | "map_forces";
  idColumn: "id_locality" | "id_landmark" | "id_force";
  typeTable: "reference_locality_types" | "reference_landmark_types" | "reference_force_types";
  typeLabel: "localite" | "landmark" | "force";
  idPrefix: "locality" | "landmark" | "force";
  dependsOnColumn?: "depends_on_locality_id";
};

type EditorLocalityPatch = Omit<EditorMapLocalityInput, "id_locality">;
type EditorLandmarkPatch = Omit<EditorMapLandmarkInput, "id_landmark">;
type EditorForcePatch = Omit<EditorMapForceInput, "id_force">;

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

export class EditorEntityNotFoundError extends Error {}

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

function normalizeStatus(value: unknown): MapObjectStatus {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "draft";
  }

  if (!isMapObjectStatus(normalized)) {
    throw new Error("Statut invalide.");
  }

  return normalized;
}

function assertSimpleIdentifier(value: string, fieldName: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(`Le champ ${fieldName} est invalide.`);
  }

  return value;
}

function normalizeFiniteNumber(value: unknown, fieldName: string): number {
  const nextValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(nextValue)) {
    throw new Error(`Le champ ${fieldName} est invalide.`);
  }

  return nextValue;
}

function generateEditorObjectId(prefix: EditorEntityConfig["idPrefix"]): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
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
    throw new Error(errorMessage);
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
      throw new Error("Une localite ne peut pas dependre d'elle-meme.");
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

function normalizeEditorObjectInput(
  config: EditorEntityConfig,
  input:
    | EditorMapLocalityInput
    | EditorMapLandmarkInput
    | EditorMapForceInput
    | EditorLocalityPatch
    | EditorLandmarkPatch
    | EditorForcePatch,
  providedId?: string,
): NormalizedEditorObjectInput {
  const name = normalizeText(input.name);
  const typeKey = normalizeText(input.type_key);

  if (!name) {
    throw new Error("Le nom est obligatoire.");
  }

  if (!typeKey) {
    throw new Error("Le type est obligatoire.");
  }

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
    status: normalizeStatus(input.status),
    description: normalizeNullableText(input.description),
    depends_on_locality_id: config.dependsOnColumn
      ? normalizeNullableText((input as EditorMapLocalityInput).depends_on_locality_id)
      : null,
  };
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

async function getEditorReferenceDataInternal(client: PoolClient): Promise<EditorReferenceData> {
  const [localityTypes, landmarkTypes, forceTypes, mapIcons, factions, controleurs] =
    await Promise.all([
      listReferenceOptions(
        client,
        "reference_locality_types",
        "type_key",
        "COALESCE(label, type_key)",
        "WHERE is_active = TRUE",
      ),
      listReferenceOptions(
        client,
        "reference_landmark_types",
        "type_key",
        "COALESCE(label, type_key)",
        "WHERE is_active = TRUE",
      ),
      listReferenceOptions(
        client,
        "reference_force_types",
        "type_key",
        "COALESCE(label, type_key)",
        "WHERE is_active = TRUE",
      ),
      listReferenceOptions(
        client,
        "reference_map_icons",
        "icon_key",
        "COALESCE(label, icon_key)",
        "WHERE is_active = TRUE",
      ),
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

  const result = await client.query<T>(
    `
      INSERT INTO ${config.tableName} (${columns.join(", ")})
      VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
      RETURNING *
    `,
    values,
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Creation impossible.");
  }

  return row;
}

async function updateEditorEntity<T extends EditorLocalityRow | EditorLandmarkRow | EditorForceRow>(
  client: PoolClient,
  config: EditorEntityConfig,
  id: string,
  input: EditorLocalityPatch | EditorLandmarkPatch | EditorForcePatch,
  userId: number,
): Promise<T> {
  const normalized = normalizeEditorObjectInput(config, input, id);
  await getEditorEntityRow(client, config, id);
  await validateEditorObjectReferences(client, config, normalized);

  const assignments = [
    "name = $2",
    "type_key = $3",
    "icon_key = $4",
    "x = $5",
    "y = $6",
    "id_case_detected = $7",
    "faction = $8",
    "controleur = $9",
    "status = $10",
    ...(config.dependsOnColumn ? [`${config.dependsOnColumn} = $11`] : []),
    `description = $${config.dependsOnColumn ? 12 : 11}`,
    `updated_by_user_id = $${config.dependsOnColumn ? 13 : 12}`,
    "updated_at = NOW()",
  ];

  const values = [
    id,
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
  input: EditorLocalityPatch,
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
  input: EditorLandmarkPatch,
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
  input: EditorForcePatch,
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
