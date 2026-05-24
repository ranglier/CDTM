import { Pool, type PoolClient } from "pg";

import controleursExample from "../../data/reference/controleurs.example.json";
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
    await client.query(`DROP TABLE IF EXISTS case_notes_current`);
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
        peuple TEXT,
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
      ALTER TABLE case_emplacements_current
      ADD COLUMN IF NOT EXISTS peuple TEXT
    `);
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'case_emplacements_current'
            AND column_name = 'peuple_majoritaire'
        ) THEN
          UPDATE case_emplacements_current
          SET peuple = COALESCE(peuple, peuple_majoritaire)
          WHERE peuple IS NULL
            AND peuple_majoritaire IS NOT NULL;
        END IF;
      END
      $$;
    `);
    await client.query(`
      ALTER TABLE case_emplacements_current
      DROP COLUMN IF EXISTS peuple_majoritaire
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
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE localites
      DROP COLUMN IF EXISTS visibilite
    `);
    await client.query(`
      ALTER TABLE localites
      DROP COLUMN IF EXISTS note_publique
    `);
    await client.query(`
      ALTER TABLE localites
      DROP COLUMN IF EXISTS note_staff
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
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (group_key, entry_key)
      )
    `);
    await client.query(`
      ALTER TABLE reference_nomenclature_values
      DROP COLUMN IF EXISTS sort_order
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
        pattern_type TEXT,
        pattern_color TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE reference_styles
      ADD COLUMN IF NOT EXISTS pattern_type TEXT
    `);
    await client.query(`
      ALTER TABLE reference_styles
      ADD COLUMN IF NOT EXISTS pattern_color TEXT
    `);
    await client.query(`
      ALTER TABLE reference_styles
      DROP COLUMN IF EXISTS opacity
    `);
    await client.query(`DROP TABLE IF EXISTS reference_emplacements_rules`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_map_icons (
        icon_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        source_url TEXT,
        author TEXT,
        license TEXT NOT NULL DEFAULT 'CC BY 3.0',
        category TEXT,
        image_path TEXT,
        image_original_name TEXT,
        image_mime_type TEXT,
        image_size_bytes INTEGER,
        image_alt TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      ALTER COLUMN source_url DROP NOT NULL
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      ALTER COLUMN author DROP NOT NULL
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      ADD COLUMN IF NOT EXISTS image_path TEXT
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      ADD COLUMN IF NOT EXISTS image_original_name TEXT
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      ADD COLUMN IF NOT EXISTS image_mime_type TEXT
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      ADD COLUMN IF NOT EXISTS image_size_bytes INTEGER
    `);
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'reference_map_icons'
            AND column_name = 'image_url'
        ) THEN
          UPDATE reference_map_icons
          SET image_path = image_url
          WHERE image_path IS NULL
            AND image_url IS NOT NULL
            AND image_url LIKE '/uploads/map-icons/%';
        END IF;
      END
      $$;
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      DROP COLUMN IF EXISTS image_url
    `);
    await client.query(`
      ALTER TABLE reference_map_icons
      DROP COLUMN IF EXISTS sort_order
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_locality_types (
        type_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        default_icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL,
        consumes_slot BOOLEAN NOT NULL DEFAULT FALSE,
        slot_weight INTEGER NOT NULL DEFAULT 0 CHECK (slot_weight >= 0),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_landmark_types (
        type_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        default_icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_force_types (
        type_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        default_icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_localities (
        id_locality TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_key TEXT NOT NULL REFERENCES reference_locality_types(type_key) ON DELETE RESTRICT,
        icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL,
        x DOUBLE PRECISION NOT NULL,
        y DOUBLE PRECISION NOT NULL,
        id_case_detected TEXT REFERENCES case_registry(id_case) ON DELETE SET NULL,
        faction TEXT,
        controleur TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        depends_on_locality_id TEXT REFERENCES map_localities(id_locality) ON DELETE SET NULL,
        description TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_landmarks (
        id_landmark TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_key TEXT NOT NULL REFERENCES reference_landmark_types(type_key) ON DELETE RESTRICT,
        icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL,
        x DOUBLE PRECISION NOT NULL,
        y DOUBLE PRECISION NOT NULL,
        id_case_detected TEXT REFERENCES case_registry(id_case) ON DELETE SET NULL,
        faction TEXT,
        controleur TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        description TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_forces (
        id_force TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type_key TEXT NOT NULL REFERENCES reference_force_types(type_key) ON DELETE RESTRICT,
        icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL,
        x DOUBLE PRECISION NOT NULL,
        y DOUBLE PRECISION NOT NULL,
        id_case_detected TEXT REFERENCES case_registry(id_case) ON DELETE SET NULL,
        faction TEXT,
        controleur TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        description TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO reference_locality_types (
        type_key,
        label,
        description,
        default_icon_key,
        consumes_slot,
        slot_weight,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        type_key,
        label,
        description,
        default_icon_key,
        consumes_slot,
        slot_weight,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM reference_map_point_types
      WHERE object_family = 'locality'
      ON CONFLICT (type_key) DO NOTHING
    `).catch(() => undefined);
    await client.query(`
      INSERT INTO reference_landmark_types (
        type_key,
        label,
        description,
        default_icon_key,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        type_key,
        label,
        description,
        default_icon_key,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM reference_map_point_types
      WHERE object_family = 'landmark'
      ON CONFLICT (type_key) DO NOTHING
    `).catch(() => undefined);
    await client.query(`
      INSERT INTO reference_force_types (
        type_key,
        label,
        description,
        default_icon_key,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        type_key,
        label,
        description,
        default_icon_key,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM reference_map_point_types
      WHERE object_family = 'force'
      ON CONFLICT (type_key) DO NOTHING
    `).catch(() => undefined);
    await client.query(`
      INSERT INTO map_localities (
        id_locality,
        name,
        type_key,
        icon_key,
        x,
        y,
        id_case_detected,
        faction,
        controleur,
        status,
        depends_on_locality_id,
        description,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        id_point,
        name,
        type_key,
        icon_key,
        x,
        y,
        id_case_detected,
        faction,
        controleur,
        status,
        depends_on_point_id,
        description,
        updated_by_user_id,
        created_at,
        updated_at
      FROM map_points
      WHERE object_family = 'locality'
      ON CONFLICT (id_locality) DO NOTHING
    `).catch(() => undefined);
    await client.query(`
      INSERT INTO map_landmarks (
        id_landmark,
        name,
        type_key,
        icon_key,
        x,
        y,
        id_case_detected,
        faction,
        controleur,
        status,
        description,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        id_point,
        name,
        type_key,
        icon_key,
        x,
        y,
        id_case_detected,
        faction,
        controleur,
        status,
        description,
        updated_by_user_id,
        created_at,
        updated_at
      FROM map_points
      WHERE object_family = 'landmark'
      ON CONFLICT (id_landmark) DO NOTHING
    `).catch(() => undefined);
    await client.query(`
      INSERT INTO map_forces (
        id_force,
        name,
        type_key,
        icon_key,
        x,
        y,
        id_case_detected,
        faction,
        controleur,
        status,
        description,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        id_point,
        name,
        type_key,
        icon_key,
        x,
        y,
        id_case_detected,
        faction,
        controleur,
        status,
        description,
        updated_by_user_id,
        created_at,
        updated_at
      FROM map_points
      WHERE object_family = 'force'
      ON CONFLICT (id_force) DO NOTHING
    `).catch(() => undefined);
    await client.query(`
      CREATE TABLE IF NOT EXISTS map_routes (
        id_route TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        route_type TEXT NOT NULL,
        points_json JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        faction TEXT,
        controleur TEXT,
        description TEXT,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_races (
        race_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE reference_races
      DROP COLUMN IF EXISTS sort_order
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reference_peuples (
        peuple_key TEXT PRIMARY KEY,
        race_key TEXT NOT NULL REFERENCES reference_races(race_key) ON DELETE RESTRICT,
        label TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE reference_peuples
      DROP COLUMN IF EXISTS sort_order
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (table_key, field_key)
      )
    `);
    await client.query(`
      ALTER TABLE dynamic_case_table_fields
      DROP COLUMN IF EXISTS sort_order
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
      ON reference_nomenclature_values(group_key, label, entry_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS dynamic_case_fields_table_idx
      ON dynamic_case_table_fields(table_key, label, field_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS reference_map_icons_active_idx
      ON reference_map_icons(is_active, label, icon_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS reference_peuples_race_idx
      ON reference_peuples(race_key, label, peuple_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS reference_locality_types_label_idx
      ON reference_locality_types(label, type_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS reference_landmark_types_label_idx
      ON reference_landmark_types(label, type_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS reference_force_types_label_idx
      ON reference_force_types(label, type_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS map_localities_status_idx
      ON map_localities(status, type_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS map_landmarks_status_idx
      ON map_landmarks(status, type_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS map_forces_status_idx
      ON map_forces(status, type_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS map_routes_status_idx
      ON map_routes(status, route_type)
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
