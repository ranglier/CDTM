import { Pool, type PoolClient } from "pg";

import controleursExample from "../../data/reference/controleurs.example.json";
import type { AdminRole } from "@/admin/roles";
import nomenclatures from "../../data/reference/nomenclatures.json";
import { referenceTableDefinitions } from "@/admin/tech-types";
import { runDatabaseMigrations } from "@/server/db-migrations";
import { getServerEnv } from "@/server/env";
import { hashSecret } from "@/server/security";
import { loadStableCaseIndex } from "@/server/stable-case-source";

type GlobalDatabaseState = typeof globalThis & {
  __cdtmPool?: Pool;
  __cdtmDbInit?: Promise<boolean>;
};

function getGlobalDatabaseState(): GlobalDatabaseState {
  return globalThis as GlobalDatabaseState;
}

function assertSafeSqlIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`SQL identifier invalide: ${identifier}`);
  }

  return `"${identifier}"`;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(getServerEnv().databaseUrl);
}

export function getPool(): Pool {
  const env = getServerEnv();
  const globals = getGlobalDatabaseState();

  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required to use the admin database.");
  }

  if (!globals.__cdtmPool) {
    globals.__cdtmPool = new Pool({
      connectionString: env.databaseUrl,
    });
  }

  return globals.__cdtmPool;
}

async function loadStableCaseIds(): Promise<string[]> {
  return Array.from((await loadStableCaseIndex()).keys()).sort();
}

async function seedReferenceCatalog(client: PoolClient): Promise<void> {
  for (const definition of referenceTableDefinitions) {
    await client.query(
      `
        INSERT INTO reference_table_catalog (table_key, title, description, physical_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (table_key) DO NOTHING
      `,
      [
        definition.key,
        definition.title,
        definition.description,
        definition.physical_name,
      ],
    );
  }
}

async function seedNomenclatures(client: PoolClient): Promise<void> {
  await client.query(
    `
      UPDATE reference_nomenclature_values
      SET
        entry_key = 'terres_gelees',
        label = 'terres_gelees',
        id_entry = CASE
          WHEN group_key = 'terrain_type' THEN 'terrain_type:terres_gelees'
          ELSE id_entry
        END,
        updated_at = NOW()
      WHERE group_key = 'terrain_type'
        AND entry_key = 'desert_glace'
    `,
  );

  await client.query(
    `
      UPDATE reference_nomenclature_values
      SET
        updated_at = NOW()
      WHERE FALSE
    `,
  );

  await client.query(`
    DELETE FROM reference_nomenclature_values
    WHERE group_key IN ('peuple_majoritaire', 'peuple', 'visibilite')
  `);

  await client.query(
    `
      UPDATE reference_nomenclature_values
      SET parent_entry_key = 'terres_gelees', updated_at = NOW()
      WHERE parent_entry_key = 'desert_glace'
    `,
  );

  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reference_nomenclature_values",
  );

  if (Number.parseInt(countResult.rows[0]?.count ?? "0", 10) > 0) {
    return;
  }

  const futureBusiness = nomenclatures.future_business as Record<string, unknown>;
  async function insertRow(
    groupKey: string,
    entryKey: string,
    label: string,
    parentEntryKey: string | null = null,
  ) {
    await client.query(
      `
        INSERT INTO reference_nomenclature_values (
          id_entry,
          group_key,
          entry_key,
          label,
          parent_entry_key
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [`${groupKey}:${entryKey}`, groupKey, entryKey, label, parentEntryKey],
    );
  }

  for (const [groupKey, rawValue] of Object.entries(futureBusiness)) {
    if (groupKey === "terrain_type" || groupKey === "faction" || groupKey === "peuple" || groupKey === "visibilite") {
      continue;
    }

    if (groupKey === "terrain_type_by_cat" && rawValue && typeof rawValue === "object") {
      for (const [categoryKey, values] of Object.entries(rawValue as Record<string, unknown>)) {
        if (!Array.isArray(values)) {
          continue;
        }

        for (const entry of values) {
          if (typeof entry === "string") {
            const normalizedEntry = entry === "desert_glace" ? "terres_gelees" : entry;
            await insertRow("terrain_type", normalizedEntry, normalizedEntry, categoryKey);
          }
        }
      }

      continue;
    }

    if (!Array.isArray(rawValue)) {
      continue;
    }

    for (const entry of rawValue) {
      if (typeof entry === "string") {
        const normalizedEntry =
          groupKey === "terrain_type" && entry === "desert_glace" ? "terres_gelees" : entry;
        await insertRow(groupKey, normalizedEntry, normalizedEntry);
      }
    }
  }
}

async function seedFactions(client: PoolClient): Promise<void> {
  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reference_factions",
  );

  if (Number.parseInt(countResult.rows[0]?.count ?? "0", 10) > 0) {
    return;
  }

  const factions =
    ((nomenclatures.future_business as Record<string, unknown>).faction as string[] | undefined) ?? [];

  for (const factionId of factions) {
    await client.query(
      `
        INSERT INTO reference_factions (id_faction, nom)
        VALUES ($1, $2)
      `,
      [factionId, factionId],
    );
  }
}

async function seedControleurs(client: PoolClient): Promise<void> {
  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reference_controleurs",
  );

  if (Number.parseInt(countResult.rows[0]?.count ?? "0", 10) > 0) {
    return;
  }

  for (const controleur of controleursExample as Array<Record<string, unknown>>) {
    await client.query(
      `
        INSERT INTO reference_controleurs (id_controleur, nom, pnj)
        VALUES ($1, $2, $3)
      `,
      [
        typeof controleur.id_controleur === "string" ? controleur.id_controleur : "",
        typeof controleur.nom === "string" ? controleur.nom : null,
        typeof controleur.pnj === "boolean" ? controleur.pnj : null,
      ],
    );
  }
}

async function seedReferenceRaces(client: PoolClient): Promise<void> {
  const races = [
    "nains",
    "orques",
    "elfes",
    "hommes",
    "hobbits",
  ] as const;

  for (const raceKey of races) {
    await client.query(
      `
        INSERT INTO reference_races (race_key, label)
        VALUES ($1, $2)
        ON CONFLICT (race_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          updated_at = NOW()
      `,
      [raceKey, raceKey],
    );
  }
}

async function seedReferencePeuples(client: PoolClient): Promise<void> {
  const peuples = [
    ["nandor", "elfes"],
    ["noldor", "elfes"],
    ["sindar", "elfes"],
    ["avari", "elfes"],
    ["lossoths", "hommes"],
    ["enedwaithrim", "hommes"],
    ["druedain", "hommes"],
    ["haradrim", "hommes"],
    ["heritiers_numenor", "hommes"],
    ["umbareens", "hommes"],
    ["hommes_vertbois", "hommes"],
    ["nains", "nains"],
    ["orques", "orques"],
    ["hobbits", "hobbits"],
  ] as const;

  for (const [peupleKey, raceKey] of peuples) {
    await client.query(
      `
        INSERT INTO reference_peuples (peuple_key, race_key, label)
        VALUES ($1, $2, $3)
        ON CONFLICT (peuple_key) DO UPDATE
        SET
          race_key = EXCLUDED.race_key,
          label = EXCLUDED.label,
          updated_at = NOW()
      `,
      [peupleKey, raceKey, peupleKey],
    );
  }
}

async function seedLocalityTypes(client: PoolClient): Promise<void> {
  for (const [typeKey, consumesSlot] of [
    ["fort", true],
    ["ville_fortifiee", true],
    ["ville_non_fortifiee", true],
    ["avant_poste", true],
    ["hobbit_bourg", true],
    ["dependance", false],
  ] as const) {
    await client.query(
      `
        INSERT INTO reference_locality_types (
          type_key,
          label,
          default_icon_key,
          consumes_slot,
          slot_weight
        )
        VALUES ($1, $2, NULL, $3, $4)
        ON CONFLICT (type_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          consumes_slot = EXCLUDED.consumes_slot,
          slot_weight = EXCLUDED.slot_weight,
          updated_at = NOW()
      `,
      [typeKey, typeKey, consumesSlot, 0],
    );
  }
}

async function seedLandmarkTypes(client: PoolClient): Promise<void> {
  for (const typeKey of ["ruines", "port", "pont", "mine", "barad_dur", "moria", "hauts_des_galgals"] as const) {
    await client.query(
      `
        INSERT INTO reference_landmark_types (
          type_key,
          label,
          default_icon_key
        )
        VALUES ($1, $2, NULL)
        ON CONFLICT (type_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          updated_at = NOW()
      `,
      [typeKey, typeKey],
    );
  }
}

async function seedForceTypes(client: PoolClient): Promise<void> {
  for (const typeKey of ["armee", "flotte"] as const) {
    await client.query(
      `
        INSERT INTO reference_force_types (
          type_key,
          label,
          default_icon_key
        )
        VALUES ($1, $2, NULL)
        ON CONFLICT (type_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          updated_at = NOW()
      `,
      [typeKey, typeKey],
    );
  }
}

async function seedReferenceTables(client: PoolClient): Promise<void> {
  await seedReferenceCatalog(client);
  await seedNomenclatures(client);
  await seedFactions(client);
  await seedControleurs(client);
  await seedReferenceRaces(client);
  await seedReferencePeuples(client);
  await seedLocalityTypes(client);
  await seedLandmarkTypes(client);
  await seedForceTypes(client);
}

async function seedRuntimeReferenceTables(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await seedReferenceTables(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function syncCaseRegistry(pool: Pool): Promise<void> {
  const caseIds = await loadStableCaseIds();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM case_registry WHERE NOT (id_case = ANY($1::text[]))", [caseIds]);

    for (const caseId of caseIds) {
      await client.query(
        `
          INSERT INTO case_registry (id_case)
          VALUES ($1)
          ON CONFLICT (id_case) DO NOTHING
        `,
        [caseId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function syncDynamicCaseTableRows(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    const result = await client.query<{ physical_name: string }>(
      `
        SELECT physical_name
        FROM dynamic_case_tables
      `,
    );

    for (const row of result.rows) {
      const tableName = assertSafeSqlIdentifier(row.physical_name);

      await client.query(
        `
          INSERT INTO ${tableName} (id_case)
          SELECT id_case
          FROM case_registry
          ON CONFLICT (id_case) DO NOTHING
        `,
      );
    }
  } finally {
    client.release();
  }
}

async function bootstrapAdminUser(pool: Pool): Promise<void> {
  const env = getServerEnv();

  if (!env.bootstrapAdminUsername || !env.bootstrapAdminPassword) {
    return;
  }

  const passwordHash = await hashSecret(env.bootstrapAdminPassword);

  await pool.query(
    `
      INSERT INTO staff_users (username, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE
      SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `,
    [env.bootstrapAdminUsername, passwordHash, "tech_admin" satisfies AdminRole, true],
  );
}

async function initializeDatabase(): Promise<boolean> {
  const pool = getPool();
  await runDatabaseMigrations(pool);
  await seedRuntimeReferenceTables(pool);
  await syncCaseRegistry(pool);
  await syncDynamicCaseTableRows(pool);
  await bootstrapAdminUser(pool);

  return true;
}

export async function ensureDatabaseReady(): Promise<boolean> {
  const globals = getGlobalDatabaseState();

  if (!isDatabaseConfigured()) {
    return false;
  }

  if (!globals.__cdtmDbInit) {
    globals.__cdtmDbInit = initializeDatabase().catch((error) => {
      globals.__cdtmDbInit = undefined;
      throw error;
    });
  }

  return globals.__cdtmDbInit;
}
