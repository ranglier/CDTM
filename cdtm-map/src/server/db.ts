import { Pool } from "pg";

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

async function bootstrapAdminUser(pool: Pool): Promise<void> {
  const env = getServerEnv();

  if (!env.bootstrapAdminUsername || !env.bootstrapAdminPassword) {
    return;
  }

  const passwordHash = await hashSecret(env.bootstrapAdminPassword);

  await pool.query(
    `
      INSERT INTO staff_users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE
      SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `,
    [env.bootstrapAdminUsername, passwordHash],
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await syncCaseRegistry(pool);
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
