import { type Pool, type PoolClient } from "pg";

type DatabaseMigration = {
  version: string;
  name: string;
  up: (client: PoolClient) => Promise<void>;
};

const MIGRATION_LOCK_ID = 2026052501;
async function ensureSchemaMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER,
      applied_by TEXT NOT NULL DEFAULT 'app'
    )
  `);
}

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT to_regclass($1) IS NOT NULL AS exists
    `,
    [`public.${tableName}`],
  );

  return result.rows[0]?.exists === true;
}

async function columnExists(client: PoolClient, tableName: string, columnName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );

  return result.rows[0]?.exists === true;
}

function legacyStatusSql(columnName: string): string {
  return `CASE
    WHEN ${columnName} IN ('draft', 'published', 'archived') THEN ${columnName}
    ELSE 'draft'
  END`;
}

async function migrateLegacyReferenceMapPointTypes(client: PoolClient): Promise<void> {
  if (!(await tableExists(client, "reference_map_point_types"))) {
    return;
  }

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
  `);

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
  `);

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
  `);
}

async function migrateLegacyMapPoints(client: PoolClient): Promise<void> {
  if (!(await tableExists(client, "map_points"))) {
    return;
  }

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
      ${legacyStatusSql("status")},
      description,
      updated_by_user_id,
      created_at,
      updated_at
    FROM map_points
    WHERE object_family = 'locality'
    ON CONFLICT (id_locality) DO NOTHING
  `);

  if (await columnExists(client, "map_points", "depends_on_point_id")) {
    await client.query(`
      UPDATE map_localities AS target
      SET depends_on_locality_id = source.depends_on_point_id
      FROM map_points AS source
      WHERE source.object_family = 'locality'
        AND source.id_point = target.id_locality
        AND source.depends_on_point_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM map_localities AS dependency
          WHERE dependency.id_locality = source.depends_on_point_id
        )
    `);
  }

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
      ${legacyStatusSql("status")},
      description,
      updated_by_user_id,
      created_at,
      updated_at
    FROM map_points
    WHERE object_family = 'landmark'
    ON CONFLICT (id_landmark) DO NOTHING
  `);

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
      ${legacyStatusSql("status")},
      description,
      updated_by_user_id,
      created_at,
      updated_at
    FROM map_points
    WHERE object_family = 'force'
    ON CONFLICT (id_force) DO NOTHING
  `);

  await client.query(`DROP TABLE IF EXISTS map_points`);
}

const databaseMigrations: DatabaseMigration[] = [
  {
    version: "001",
    name: "core_staff_auth",
    up: async (client) => {
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
        ALTER TABLE staff_users
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
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
        CREATE INDEX IF NOT EXISTS staff_sessions_user_id_idx
        ON staff_sessions(user_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS staff_sessions_expires_at_idx
        ON staff_sessions(expires_at)
      `);
    },
  },
  {
    version: "002",
    name: "case_current_tables",
    up: async (client) => {
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
        CREATE INDEX IF NOT EXISTS localites_id_case_idx
        ON localites(id_case)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS historique_controle_id_case_idx
        ON historique_controle(id_case)
      `);
    },
  },
  {
    version: "003",
    name: "reference_tables",
    up: async (client) => {
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
    },
  },
  {
    version: "004",
    name: "cleanup_obsolete_admin_model",
    up: async (client) => {
      await client.query(`DROP TABLE IF EXISTS case_notes_current`);
      await client.query(`DROP TABLE IF EXISTS reference_emplacements_rules`);
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
        ALTER TABLE reference_nomenclature_values
        DROP COLUMN IF EXISTS sort_order
      `);
      await client.query(`
        ALTER TABLE reference_map_icons
        DROP COLUMN IF EXISTS sort_order
      `);
      await client.query(`
        ALTER TABLE reference_races
        DROP COLUMN IF EXISTS sort_order
      `);
      await client.query(`
        ALTER TABLE reference_peuples
        DROP COLUMN IF EXISTS sort_order
      `);
      await client.query(`
        ALTER TABLE dynamic_case_table_fields
        DROP COLUMN IF EXISTS sort_order
      `);
    },
  },
  {
    version: "005",
    name: "split_map_point_model",
    up: async (client) => {
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
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS description TEXT
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS default_icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS consumes_slot BOOLEAN DEFAULT FALSE
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS slot_weight INTEGER DEFAULT 0
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await client.query(`
        ALTER TABLE reference_locality_types
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await client.query(`
        UPDATE reference_locality_types
        SET
          consumes_slot = COALESCE(consumes_slot, FALSE),
          slot_weight = COALESCE(slot_weight, 0),
          is_active = COALESCE(is_active, TRUE),
          created_at = COALESCE(created_at, NOW()),
          updated_at = COALESCE(updated_at, NOW())
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
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS description TEXT
      `);
      await client.query(`
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS default_icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL
      `);
      await client.query(`
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
      `);
      await client.query(`
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL
      `);
      await client.query(`
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await client.query(`
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await client.query(`
        UPDATE reference_landmark_types
        SET
          is_active = COALESCE(is_active, TRUE),
          created_at = COALESCE(created_at, NOW()),
          updated_at = COALESCE(updated_at, NOW())
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
        ALTER TABLE reference_force_types
        ADD COLUMN IF NOT EXISTS description TEXT
      `);
      await client.query(`
        ALTER TABLE reference_force_types
        ADD COLUMN IF NOT EXISTS default_icon_key TEXT REFERENCES reference_map_icons(icon_key) ON DELETE SET NULL
      `);
      await client.query(`
        ALTER TABLE reference_force_types
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
      `);
      await client.query(`
        ALTER TABLE reference_force_types
        ADD COLUMN IF NOT EXISTS updated_by_user_id BIGINT REFERENCES staff_users(id) ON DELETE SET NULL
      `);
      await client.query(`
        ALTER TABLE reference_force_types
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await client.query(`
        ALTER TABLE reference_force_types
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await client.query(`
        UPDATE reference_force_types
        SET
          is_active = COALESCE(is_active, TRUE),
          created_at = COALESCE(created_at, NOW()),
          updated_at = COALESCE(updated_at, NOW())
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
      await migrateLegacyReferenceMapPointTypes(client);
      await migrateLegacyMapPoints(client);
      await client.query(`DROP TABLE IF EXISTS reference_map_point_types`);
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
    },
  },
  {
    version: "006",
    name: "landmark_type_categories",
    up: async (client) => {
      await client.query(`
        ALTER TABLE reference_landmark_types
        ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'landmark'
      `);
      await client.query(`
        UPDATE reference_landmark_types
        SET category = 'landmark'
        WHERE category IS NULL
           OR category NOT IN ('landmark', 'unique')
      `);
    },
  },
  {
    version: "007",
    name: "route_style_fields",
    up: async (client) => {
      await client.query(`
        ALTER TABLE map_routes
        ADD COLUMN IF NOT EXISTS geometry_mode TEXT DEFAULT 'curved'
      `);
      await client.query(`
        ALTER TABLE map_routes
        ADD COLUMN IF NOT EXISTS stroke_style TEXT DEFAULT 'solid'
      `);
      await client.query(`
        ALTER TABLE map_routes
        ADD COLUMN IF NOT EXISTS stroke_width INTEGER DEFAULT 3
      `);
      await client.query(`
        ALTER TABLE map_routes
        ADD COLUMN IF NOT EXISTS stroke_color TEXT
      `);
      await client.query(`
        UPDATE map_routes
        SET geometry_mode = 'curved'
        WHERE geometry_mode IS NULL
           OR geometry_mode NOT IN ('straight', 'curved')
      `);
      await client.query(`
        UPDATE map_routes
        SET stroke_style = 'solid'
        WHERE stroke_style IS NULL
           OR stroke_style NOT IN ('solid', 'dashed', 'dotted')
      `);
      await client.query(`
        UPDATE map_routes
        SET stroke_width = 3
        WHERE stroke_width IS NULL
           OR stroke_width < 1
           OR stroke_width > 12
      `);
    },
  },
];

export async function runDatabaseMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await ensureSchemaMigrationsTable(client);

    const appliedResult = await client.query<{ version: string }>(
      `
        SELECT version
        FROM schema_migrations
      `,
    );

    const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));

    for (const migration of databaseMigrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      const startedAt = Date.now();

      try {
        await client.query("BEGIN");
        await migration.up(client);
        await client.query(
          `
            INSERT INTO schema_migrations (version, name, execution_ms, applied_by)
            VALUES ($1, $2, $3, $4)
          `,
          [migration.version, migration.name, Date.now() - startedAt, "app"],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Database migration ${migration.version} (${migration.name}) failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
    }
  }
}
