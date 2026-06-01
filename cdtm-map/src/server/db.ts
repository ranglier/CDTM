import { Pool, type PoolClient } from "pg";

import controleursExample from "../../data/reference/controleurs.example.json";
import type { AdminRole } from "@/admin/roles";
import nomenclatures from "../../data/reference/nomenclatures.json";
import { referenceTableDefinitions } from "@/admin/tech-types";
import { PEUPLE_MODIFICATEURS_V1, TERRAIN_DEFINITIONS } from "@/map/rules";
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
    WHERE group_key IN ('peuple_majoritaire', 'peuple', 'visibilite', 'relief')
  `);
  await client.query(`
    DELETE FROM reference_styles
    WHERE cible_type = 'relief'
  `);
  await client.query(`
    DELETE FROM reference_nomenclature_values
    WHERE group_key = 'terrain_type'
      AND entry_key IN ('desert_sable', 'plaine_boisee', 'steppe', 'savane', 'glacier', 'inconnu')
  `);

  await client.query(
    `
      UPDATE reference_nomenclature_values
      SET parent_entry_key = 'terres_gelees', updated_at = NOW()
      WHERE parent_entry_key = 'desert_glace'
    `,
  );

  for (const category of Array.from(
    new Set(TERRAIN_DEFINITIONS.map((terrain) => terrain.category)),
  )) {
    await client.query(
      `
        INSERT INTO reference_nomenclature_values (id_entry, group_key, entry_key, label)
        VALUES ($1, 'terrain_cat', $2, $3)
        ON CONFLICT (group_key, entry_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          updated_at = NOW()
      `,
      [`terrain_cat:${category}`, category, category],
    );
  }

  for (const terrain of TERRAIN_DEFINITIONS) {
    await client.query(
      `
        INSERT INTO reference_nomenclature_values (
          id_entry,
          group_key,
          entry_key,
          label,
          parent_entry_key,
          emplacements_base
        )
        VALUES ($1, 'terrain_type', $2, $3, $4, $5)
        ON CONFLICT (group_key, entry_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          parent_entry_key = EXCLUDED.parent_entry_key,
          emplacements_base = EXCLUDED.emplacements_base,
          updated_at = NOW()
      `,
      [
        `terrain_type:${terrain.slug}`,
        terrain.slug,
        terrain.label,
        terrain.category,
        terrain.emplacements_base,
      ],
    );
  }

  await client.query(
    `
      INSERT INTO reference_nomenclature_values (id_entry, group_key, entry_key, label)
      VALUES ('case_attribute:colline', 'case_attribute', 'colline', 'Colline')
      ON CONFLICT (group_key, entry_key) DO UPDATE
      SET
        label = EXCLUDED.label,
        updated_at = NOW()
    `,
  );

  await client.query(
    `
      INSERT INTO reference_styles (
        id_style,
        cible_type,
        cible_id,
        fill,
        stroke,
        pattern_type,
        pattern_color
      )
      VALUES (
        'case_attribute:colline',
        'case_attribute',
        'colline',
        NULL,
        NULL,
        'dots_spaced',
        '#281e0e'
      )
      ON CONFLICT (id_style) DO NOTHING
    `,
  );

  await client.query(
    `
      INSERT INTO reference_nomenclature_values (
        id_entry,
        group_key,
        entry_key,
        label
      )
      VALUES
        ('controle_type:aucun', 'controle_type', 'aucun', 'aucun'),
        ('controle_type:total', 'controle_type', 'total', 'total'),
        ('controle_type:partiel', 'controle_type', 'partiel', 'partiel'),
        ('controle_type:conteste', 'controle_type', 'conteste', 'conteste'),
        ('controle_type:occupe', 'controle_type', 'occupe', 'occupe'),
        ('controle_type:vassalise', 'controle_type', 'vassalise', 'vassalise'),
        ('controle_type:inconnu', 'controle_type', 'inconnu', 'inconnu')
      ON CONFLICT (group_key, entry_key) DO UPDATE
      SET
        label = EXCLUDED.label,
        updated_at = NOW()
    `,
  );

  await client.query(
    `
      INSERT INTO reference_styles (
        id_style,
        cible_type,
        cible_id,
        fill,
        stroke,
        pattern_type,
        pattern_color,
        secondary_ratio
      )
      VALUES
        (
          'controle_type:conteste',
          'controle_type',
          'conteste',
          NULL,
          NULL,
          'diagonal_spaced',
          '#000000',
          0.5
        ),
        (
          'controle_type:vassalise',
          'controle_type',
          'vassalise',
          NULL,
          NULL,
          'diagonal_reverse_spaced',
          '#000000',
          0.3
        ),
        (
          'controle_type:occupe',
          'controle_type',
          'occupe',
          NULL,
          NULL,
          'vertical_spaced',
          '#000000',
          0.9
        ),
        (
          'controle_type:partiel',
          'controle_type',
          'partiel',
          NULL,
          NULL,
          'horizontal_spaced',
          '#000000',
          0.5
        )
      ON CONFLICT (id_style) DO UPDATE
      SET
        secondary_ratio = COALESCE(reference_styles.secondary_ratio, EXCLUDED.secondary_ratio),
        updated_at = NOW()
    `,
  );

  const countResult = await client.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reference_nomenclature_values",
  );

  if (Number.parseInt(countResult.rows[0]?.count ?? "0", 10) > 0) {
    return;
  }

  const futureBusiness = nomenclatures.future_business as Record<
    string,
    unknown
  >;
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
    if (
      groupKey === "terrain_type" ||
      groupKey === "faction" ||
      groupKey === "peuple" ||
      groupKey === "relief" ||
      groupKey === "visibilite"
    ) {
      continue;
    }

    if (
      groupKey === "terrain_type_by_cat" &&
      rawValue &&
      typeof rawValue === "object"
    ) {
      for (const [categoryKey, values] of Object.entries(
        rawValue as Record<string, unknown>,
      )) {
        if (!Array.isArray(values)) {
          continue;
        }

        for (const entry of values) {
          if (typeof entry === "string") {
            const normalizedEntry =
              entry === "desert_glace" ? "terres_gelees" : entry;
            await insertRow(
              "terrain_type",
              normalizedEntry,
              normalizedEntry,
              categoryKey,
            );
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
          groupKey === "terrain_type" && entry === "desert_glace"
            ? "terres_gelees"
            : entry;
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
    ((nomenclatures.future_business as Record<string, unknown>).faction as
      | string[]
      | undefined) ?? [];

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

  for (const controleur of controleursExample as Array<
    Record<string, unknown>
  >) {
    await client.query(
      `
        INSERT INTO reference_controleurs (id_controleur, nom, pnj)
        VALUES ($1, $2, $3)
      `,
      [
        typeof controleur.id_controleur === "string"
          ? controleur.id_controleur
          : "",
        typeof controleur.nom === "string" ? controleur.nom : null,
        typeof controleur.pnj === "boolean" ? controleur.pnj : null,
      ],
    );
  }
}

async function seedReferenceRaces(client: PoolClient): Promise<void> {
  const races = ["nains", "orques", "elfes", "hommes", "hobbits"] as const;

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
    ["hommes", "hommes", "Hommes"],
    ["elfes", "elfes", "Elfes"],
    ["orques", "orques", "Orcs"],
    ["nains", "nains", "Nains"],
    ["hobbits", "hobbits", "Hobbits"],
    ["nandor", "elfes", "Nandor"],
    ["noldor", "elfes", "Noldor"],
    ["sindar", "elfes", "Sindar"],
    ["avari", "elfes", "Avari"],
    ["lossoths", "hommes", "Lossoth"],
    ["enedwaithrim", "hommes", "Enedwaithrim"],
    ["druedain", "hommes", "Druedain"],
    ["haradrim", "hommes", "Haradrim"],
    ["heritiers_numenor", "hommes", "Heritiers de Numenor"],
    ["umbareens", "hommes", "Umbareens"],
    ["hommes_vertbois", "hommes", "Hommes de Vert-Bois"],
  ] as const;

  for (const [peupleKey, raceKey, label] of peuples) {
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
      [peupleKey, raceKey, label],
    );
  }
}

async function seedPeupleModificateurs(client: PoolClient): Promise<void> {
  for (const modifier of PEUPLE_MODIFICATEURS_V1) {
    await client.query(
      `
        INSERT INTO reference_peuple_modificateurs (
          peuple_slug,
          type_declencheur,
          declencheur,
          valeur,
          groupe_logique,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (peuple_slug, type_declencheur, declencheur) DO UPDATE
        SET
          valeur = EXCLUDED.valeur,
          groupe_logique = EXCLUDED.groupe_logique,
          description = EXCLUDED.description,
          updated_at = NOW()
      `,
      [
        modifier.peuple_slug,
        modifier.type_declencheur,
        modifier.declencheur,
        modifier.valeur,
        "groupe_logique" in modifier ? (modifier.groupe_logique ?? null) : null,
        "description" in modifier ? (modifier.description ?? null) : null,
      ],
    );
  }
}

async function seedLocalityTypes(client: PoolClient): Promise<void> {
  for (const [typeKey, label, consumesSlot, empRequis, upgradesFromTypeId] of [
    ["avant_poste", "Avant-poste", true, 1, null],
    ["hameau", "Hameau", true, 1, "avant_poste"],
    ["village", "Village", true, 1, "hameau"],
    ["bourg", "Bourg", true, 2, "village"],
    ["ville", "Ville", true, 3, "bourg"],
    ["cite", "Cite", true, 4, "ville"],
    ["fort", "Fort", true, 2, "avant_poste"],
    ["dependance", "Dependance", false, 0, null],
  ] as const) {
    await client.query(
      `
        INSERT INTO reference_locality_types (
          type_key,
          label,
          default_icon_key,
          consumes_slot,
          emp_requis,
          upgrades_from_type_id
        )
        VALUES ($1, $2, NULL, $3, $4, $5)
        ON CONFLICT (type_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          consumes_slot = EXCLUDED.consumes_slot,
          emp_requis = EXCLUDED.emp_requis,
          upgrades_from_type_id = EXCLUDED.upgrades_from_type_id,
          updated_at = NOW()
      `,
      [typeKey, label, consumesSlot, empRequis, upgradesFromTypeId],
    );
  }
}

async function seedLandmarkTypes(client: PoolClient): Promise<void> {
  for (const [typeKey, label, description, category] of [
    [
      "pont",
      "Pont",
      "Passage construit permettant de franchir un obstacle.",
      "landmark",
    ],
    ["gue", "Gue", "Passage praticable a travers un cours d'eau.", "landmark"],
    ["mine", "Mine", "Exploitation miniere ou site d'extraction.", "landmark"],
    [
      "port",
      "Port",
      "Port, embarcadere ou point d'acces fluvial ou maritime.",
      "landmark",
    ],
    [
      "col_montagne",
      "Col de montagne",
      "Passage notable a travers une chaine montagneuse.",
      "landmark",
    ],
    [
      "lieu_unique",
      "Lieu unique",
      "Lieu nomme ou remarquable propre a la Terre du Milieu.",
      "unique",
    ],
  ] as const) {
    await client.query(
      `
        INSERT INTO reference_landmark_types (
          type_key,
          label,
          description,
          category,
          default_icon_key,
          consumes_slot,
          emp_requis,
          is_active
        )
        VALUES ($1, $2, $3, $4, NULL, FALSE, 0, TRUE)
        ON CONFLICT (type_key) DO UPDATE
        SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          consumes_slot = EXCLUDED.consumes_slot,
          emp_requis = EXCLUDED.emp_requis,
          is_active = TRUE,
          updated_at = NOW()
      `,
      [typeKey, label, description, category],
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
  await seedPeupleModificateurs(client);
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
    await client.query(
      "DELETE FROM case_registry WHERE NOT (id_case = ANY($1::text[]))",
      [caseIds],
    );

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
    [
      env.bootstrapAdminUsername,
      passwordHash,
      "tech_admin" satisfies AdminRole,
      true,
    ],
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
