import { Pool, type PoolClient } from "pg";

import controleursExample from "../../data/reference/controleurs.example.json";
import emplacementsRules from "../../data/reference/emplacements_rules.json";
import type { AdminRole } from "@/admin/roles";
import nomenclatures from "../../data/reference/nomenclatures.json";
import { referenceTableDefinitions } from "@/admin/tech-types";
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
  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reference_nomenclature_values",
  );

  if (Number.parseInt(countResult.rows[0]?.count ?? "0", 10) > 0) {
    return;
  }

  const futureBusiness = nomenclatures.future_business as Record<string, unknown>;
  let sortOrder = 0;

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
          parent_entry_key,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [`${groupKey}:${entryKey}`, groupKey, entryKey, label, parentEntryKey, sortOrder++],
    );
  }

  for (const [groupKey, rawValue] of Object.entries(futureBusiness)) {
    if (groupKey === "terrain_type" || groupKey === "faction") {
      continue;
    }

    if (groupKey === "terrain_type_by_cat" && rawValue && typeof rawValue === "object") {
      for (const [categoryKey, values] of Object.entries(rawValue as Record<string, unknown>)) {
        if (!Array.isArray(values)) {
          continue;
        }

        for (const entry of values) {
          if (typeof entry === "string") {
            await insertRow("terrain_type", entry, entry, categoryKey);
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
        await insertRow(groupKey, entry, entry);
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

async function seedEmplacementsRules(client: PoolClient): Promise<void> {
  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reference_emplacements_rules",
  );

  if (Number.parseInt(countResult.rows[0]?.count ?? "0", 10) > 0) {
    return;
  }

  const rules = [
    {
      rule_key: "status",
      rule_label: "status",
      value_text: typeof emplacementsRules.status === "string" ? emplacementsRules.status : null,
      value_integer: null,
      description: "Etat global des regles d'emplacements.",
    },
    {
      rule_key: "note",
      rule_label: "note",
      value_text: typeof emplacementsRules.note === "string" ? emplacementsRules.note : null,
      value_integer: null,
      description: "Note generale de contexte.",
    },
    {
      rule_key: "calculation_note",
      rule_label: "calculation_note",
      value_text:
        typeof emplacementsRules.calculation_note === "string"
          ? emplacementsRules.calculation_note
          : null,
      value_integer: null,
      description: "Description du calcul vise.",
    },
    {
      rule_key: "bounds_min",
      rule_label: "bounds_min",
      value_text: null,
      value_integer:
        typeof emplacementsRules.bounds?.min === "number" ? emplacementsRules.bounds.min : null,
      description: "Borne minimale des emplacements.",
    },
    {
      rule_key: "bounds_max",
      rule_label: "bounds_max",
      value_text: null,
      value_integer:
        typeof emplacementsRules.bounds?.max === "number" ? emplacementsRules.bounds.max : null,
      description: "Borne maximale des emplacements.",
    },
  ];

  for (const rule of rules) {
    await client.query(
      `
        INSERT INTO reference_emplacements_rules (
          rule_key,
          rule_label,
          value_text,
          value_integer,
          description
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        rule.rule_key,
        rule.rule_label,
        rule.value_text,
        rule.value_integer,
        rule.description,
      ],
    );
  }
}

async function seedReferenceTables(client: PoolClient): Promise<void> {
  await seedReferenceCatalog(client);
  await seedNomenclatures(client);
  await seedFactions(client);
  await seedControleurs(client);
  await seedEmplacementsRules(client);
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_registry (
        id_case TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      ALTER TABLE staff_users
      ADD COLUMN IF NOT EXISTS role TEXT
    `);
    await client.query(`
      ALTER TABLE staff_users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN
    `);
    await client.query(`
      UPDATE staff_users
      SET role = 'staff'
      WHERE role IS NULL OR role NOT IN ('staff', 'tech_admin')
    `);
    await client.query(`
      UPDATE staff_users
      SET is_active = TRUE
      WHERE is_active IS NULL
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN role SET DEFAULT 'staff'
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN role SET NOT NULL
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN is_active SET DEFAULT TRUE
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN is_active SET NOT NULL
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
        session_token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_notes_current (
        id_case TEXT PRIMARY KEY REFERENCES case_registry(id_case) ON DELETE CASCADE,
        note_publique TEXT,
        note_staff TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_terrain_current (
        id_case TEXT PRIMARY KEY REFERENCES case_registry(id_case) ON DELETE CASCADE,
        terrain_cat TEXT,
        terrain_type TEXT,
        relief TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_control_current (
        id_case TEXT PRIMARY KEY REFERENCES case_registry(id_case) ON DELETE CASCADE,
        faction TEXT,
        controleur TEXT,
        controle_type TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_emplacements_current (
        id_case TEXT PRIMARY KEY REFERENCES case_registry(id_case) ON DELETE CASCADE,
        peuple_majoritaire TEXT,
        bonus_speciaux TEXT,
        empl_base INTEGER,
        empl_max INTEGER,
        regle_version TEXT,
        calcule_le TIMESTAMPTZ,
        valide_par TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_public_current (
        id_case TEXT PRIMARY KEY REFERENCES case_registry(id_case) ON DELETE CASCADE,
        public_id_case TEXT UNIQUE,
        region TEXT,
        sous_region TEXT,
        cote BOOLEAN,
        lac_majeur BOOLEAN,
        cours_eau_majeur BOOLEAN,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS localites (
        id_localite TEXT PRIMARY KEY,
        id_case TEXT NOT NULL REFERENCES case_registry(id_case) ON DELETE CASCADE,
        nom TEXT,
        niveau TEXT,
        type TEXT,
        empl INTEGER,
        visibilite TEXT,
        note_publique TEXT,
        note_staff TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS historique_controle (
        id_evenement BIGSERIAL PRIMARY KEY,
        id_case TEXT NOT NULL REFERENCES case_registry(id_case) ON DELETE CASCADE,
        date_label TEXT,
        ancien_controleur TEXT,
        nouveau_controleur TEXT,
        note TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_table_catalog (
        table_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        physical_name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_nomenclature_values (
        id_entry TEXT PRIMARY KEY,
        group_key TEXT NOT NULL,
        entry_key TEXT NOT NULL,
        label TEXT,
        parent_entry_key TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (group_key, entry_key)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_factions (
        id_faction TEXT PRIMARY KEY,
        nom TEXT,
        description_courte TEXT,
        statut TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_controleurs (
        id_controleur TEXT PRIMARY KEY,
        nom TEXT,
        pnj BOOLEAN,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_styles (
        id_style TEXT PRIMARY KEY,
        cible_type TEXT,
        cible_id TEXT,
        fill TEXT,
        stroke TEXT,
        opacity DOUBLE PRECISION,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_emplacements_rules (
        rule_key TEXT PRIMARY KEY,
        rule_label TEXT,
        value_text TEXT,
        value_integer INTEGER,
        description TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS dynamic_case_tables (
        table_key TEXT PRIMARY KEY,
        physical_name TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS dynamic_case_table_fields (
        table_key TEXT NOT NULL REFERENCES dynamic_case_tables(table_key) ON DELETE CASCADE,
        field_key TEXT NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT NOT NULL,
        reference_table_key TEXT,
        reference_group_key TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (table_key, field_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS staff_sessions_user_id_idx
      ON staff_sessions(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS staff_sessions_expires_at_idx
      ON staff_sessions(expires_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS localites_id_case_idx
      ON localites(id_case)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS historique_controle_id_case_idx
      ON historique_controle(id_case)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS reference_nomenclature_group_idx
      ON reference_nomenclature_values(group_key, sort_order, entry_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS dynamic_case_fields_table_idx
      ON dynamic_case_table_fields(table_key, sort_order, field_key)
    `);
    await seedReferenceTables(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

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
