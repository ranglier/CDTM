import type { PoolClient } from "pg";

import {
  type AdminBonusContextuel,
  type AdminBulkPatch,
  type AdminBulkUpdateResult,
  createEmptyAdminCaseDraft,
  type AdminCaseDraft,
  type AdminCaseRecord,
} from "@/admin/types";
import type { StableCaseProperties } from "@/map/types";
import {
  calculateCaseSlots,
  countConsumedSlots,
  type PeupleModifier,
  type SlotCalculationResult,
  type SlotConsumer,
} from "@/map/rules";
import { ensureDatabaseReady, getPool } from "@/server/db";
import {
  getDynamicCaseSectionsForCase,
  getStaticAdminReferenceData,
  saveDynamicSectionsForCase,
  validateStaticAdminDraftSelections,
  validateStaticBulkPatchSelections,
} from "@/server/admin-tech-repository";
import { loadStableCaseIndex } from "@/server/stable-case-source";

type CaseLookupRow = {
  id_case: string;
  public_id_case: string | null;
  region: string | null;
  sous_region: string | null;
  cote: boolean | null;
  lac: boolean | null;
  fluvial: boolean | null;
  public_updated_at: string | null;
  public_updated_by: string | null;
  terrain_cat: string | null;
  terrain_type: string | null;
  terrain_secondaire: string | null;
  colline: boolean | null;
  relief: string | null;
  peuple: string | null;
  terrain_updated_at: string | null;
  terrain_updated_by: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
  controle_principal_type: string | null;
  controle_principal_id: string | null;
  controle_secondaire_type: string | null;
  controle_secondaire_id: string | null;
  control_updated_at: string | null;
  control_updated_by: string | null;
};

type EditableSectionPatch = Record<string, string | boolean | null | undefined>;

export class AdminCaseNotFoundError extends Error {
  constructor(idCase: string) {
    super(`La case ${idCase} est introuvable.`);
  }
}

function createSourceFallback(idCase: string): StableCaseProperties {
  return {
    registry_id_case: idCase,
    id_case: idCase,
    region: null,
    sous_region: null,
    cote: null,
    lac: null,
    fluvial: null,
  };
}

function createEmptyPublicMeta() {
  return {
    updated_at: null,
    updated_by: null,
  };
}

function toIsoStringOrNull(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function normalizeNullableField(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizePublicId(value: string, registryId: string): string | null {
  const normalized = normalizeNullableField(value);

  if (!normalized || normalized === registryId) {
    return null;
  }

  return normalized;
}

function getPresentEntries<T extends EditableSectionPatch>(
  value: T,
): Array<[keyof T & string, string | boolean | null]> {
  return Object.entries(value).filter(
    (entry): entry is [keyof T & string, string | boolean | null] => {
      const [key, currentValue] = entry;

      return (
        Object.prototype.hasOwnProperty.call(value, key) &&
        currentValue !== undefined
      );
    },
  );
}

async function listCaseContextualBonuses(
  client: PoolClient,
  idCase: string,
): Promise<AdminBonusContextuel[]> {
  const result = await client.query<AdminBonusContextuel>(
    `
      SELECT
        bonus.slug,
        COALESCE(bonus.label, bonus.slug) AS label,
        bonus.valeur,
        bonus.description
      FROM case_bonus_contextuels AS case_bonus
      INNER JOIN bonus_contextuel AS bonus ON bonus.slug = case_bonus.bonus_slug
      WHERE case_bonus.id_case = $1
        AND bonus.active = TRUE
      ORDER BY bonus.slug ASC
    `,
    [idCase],
  );

  return result.rows;
}

async function assertBonusContextuelsExist(
  client: PoolClient,
  bonusSlugs: string[],
): Promise<void> {
  if (bonusSlugs.length === 0) {
    return;
  }

  const result = await client.query<{ slug: string }>(
    `
      SELECT slug
      FROM bonus_contextuel
      WHERE active = TRUE
        AND slug = ANY($1::text[])
    `,
    [bonusSlugs],
  );
  const existingSlugs = new Set(result.rows.map((row) => row.slug));
  const missingSlug = bonusSlugs.find((slug) => !existingSlugs.has(slug));

  if (missingSlug) {
    throw new Error(`Le bonus contextuel ${missingSlug} est invalide.`);
  }
}

async function replaceCaseContextualBonuses(
  client: PoolClient,
  idCase: string,
  bonusSlugs: string[],
): Promise<void> {
  await assertBonusContextuelsExist(client, bonusSlugs);
  await client.query(
    `
      DELETE FROM case_bonus_contextuels
      WHERE id_case = $1
    `,
    [idCase],
  );

  for (const bonusSlug of bonusSlugs) {
    await client.query(
      `
        INSERT INTO case_bonus_contextuels (id_case, bonus_slug)
        VALUES ($1, $2)
        ON CONFLICT (id_case, bonus_slug) DO NOTHING
      `,
      [idCase, bonusSlug],
    );
  }
}

async function getCasePeupleSlug(
  client: PoolClient,
  idCase: string,
): Promise<string | null> {
  const result = await client.query<{ peuple: string | null }>(
    `
      SELECT peuple
      FROM case_control_current
      WHERE id_case = $1
    `,
    [idCase],
  );

  return result.rows[0]?.peuple ?? null;
}

async function listPeupleModifiers(
  client: PoolClient,
  peupleSlug: string | null,
): Promise<PeupleModifier[]> {
  if (!peupleSlug) {
    return [];
  }

  const result = await client.query<PeupleModifier>(
    `
      SELECT peuple_slug, type_declencheur, declencheur, valeur, groupe_logique, description
      FROM reference_peuple_modificateurs
      WHERE peuple_slug = $1
      ORDER BY id ASC
    `,
    [peupleSlug],
  );

  return result.rows;
}

async function listCaseSlotConsumers(
  client: PoolClient,
  idCase: string,
): Promise<SlotConsumer[]> {
  const result = await client.query<SlotConsumer>(
    `
      SELECT type_ref.consumes_slot, type_ref.emp_requis
      FROM map_localities AS locality
      INNER JOIN reference_locality_types AS type_ref ON type_ref.type_key = locality.type_key
      WHERE locality.id_case_detected = $1
        AND locality.status <> 'archived'
        AND NOT EXISTS (
          SELECT 1
          FROM map_localities AS upgraded_by
          INNER JOIN reference_locality_types AS upgraded_type ON upgraded_type.type_key = upgraded_by.type_key
          WHERE upgraded_by.depends_on_locality_id = locality.id_locality
            AND upgraded_by.id_case_detected = locality.id_case_detected
            AND upgraded_by.status <> 'archived'
            AND upgraded_type.upgrades_from_type_id = locality.type_key
        )

      UNION ALL

      SELECT type_ref.consumes_slot, type_ref.emp_requis
      FROM map_landmarks AS landmark
      INNER JOIN reference_landmark_types AS type_ref ON type_ref.type_key = landmark.type_key
      WHERE landmark.id_case_detected = $1
        AND landmark.status <> 'archived'
    `,
    [idCase],
  );

  return result.rows;
}

async function calculateSlotsForCase(
  client: PoolClient,
  idCase: string,
  fields: {
    terrain_type: string | null;
    cote: boolean | null;
    lac: boolean | null;
    fluvial: boolean | null;
    colline: boolean | null;
  },
): Promise<SlotCalculationResult> {
  const peupleSlug = await getCasePeupleSlug(client, idCase);
  const [peupleModifiers, contextualBonuses, consumers] = await Promise.all([
    listPeupleModifiers(client, peupleSlug),
    listCaseContextualBonuses(client, idCase),
    listCaseSlotConsumers(client, idCase),
  ]);

  return calculateCaseSlots({
    terrain_type: fields.terrain_type,
    peuple_slug: peupleSlug,
    attributes: {
      cote: fields.cote,
      lac: fields.lac,
      fluvial: fields.fluvial,
      colline: fields.colline,
    },
    peuple_modificateurs: peupleModifiers,
    bonus_contextuels: contextualBonuses,
    emplacements_utilises: countConsumedSlots(consumers),
  });
}

async function persistSlotCalculation(
  client: PoolClient,
  idCase: string,
  calculation: SlotCalculationResult,
  userId: number,
): Promise<void> {
  if (!calculation.available) {
    await client.query(
      `
        INSERT INTO case_emplacements_current (
          id_case,
          emplacements_base,
          malus_colline,
          modificateur_peuple,
          bonus_contextuel,
          emplacements_bruts,
          emplacements_max,
          emplacements_utilises,
          emplacements_restants,
          regle_version,
          calcule_le,
          updated_by_user_id
        )
        VALUES ($1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'v1', NOW(), $2)
        ON CONFLICT (id_case) DO UPDATE
        SET
          emplacements_base = NULL,
          malus_colline = NULL,
          modificateur_peuple = NULL,
          bonus_contextuel = NULL,
          emplacements_bruts = NULL,
          emplacements_max = NULL,
          emplacements_utilises = NULL,
          emplacements_restants = NULL,
          regle_version = 'v1',
          calcule_le = NOW(),
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [idCase, userId],
    );

    return;
  }

  await client.query(
    `
      INSERT INTO case_emplacements_current (
        id_case,
        emplacements_base,
        malus_colline,
        modificateur_peuple,
        bonus_contextuel,
        emplacements_bruts,
        emplacements_max,
        emplacements_utilises,
        emplacements_restants,
        regle_version,
        calcule_le,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'v1', NOW(), $10)
      ON CONFLICT (id_case) DO UPDATE
      SET
        emplacements_base = EXCLUDED.emplacements_base,
        malus_colline = EXCLUDED.malus_colline,
        modificateur_peuple = EXCLUDED.modificateur_peuple,
        bonus_contextuel = EXCLUDED.bonus_contextuel,
        emplacements_bruts = EXCLUDED.emplacements_bruts,
        emplacements_max = EXCLUDED.emplacements_max,
        emplacements_utilises = EXCLUDED.emplacements_utilises,
        emplacements_restants = EXCLUDED.emplacements_restants,
        regle_version = 'v1',
        calcule_le = NOW(),
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
    `,
    [
      idCase,
      calculation.emplacements_base,
      calculation.malus_colline,
      calculation.modificateur_peuple,
      calculation.bonus_contextuel,
      calculation.emplacements_bruts,
      calculation.emplacements_max,
      calculation.emplacements_utilises,
      calculation.emplacements_restants,
      userId,
    ],
  );
}

async function createEmptyAdminRecord(
  client: PoolClient,
  idCase: string,
  sourceCase: StableCaseProperties,
): Promise<AdminCaseRecord> {
  const draft = createEmptyAdminCaseDraft();
  const [dynamicSections, referenceData] = await Promise.all([
    getDynamicCaseSectionsForCase(client, idCase),
    getStaticAdminReferenceData(client),
  ]);

  return {
    id_case: idCase,
    public: {
      registry_id_case: idCase,
      id_case: sourceCase.id_case,
      region: sourceCase.region ?? null,
      sous_region: sourceCase.sous_region ?? null,
      cote: sourceCase.cote ?? null,
      lac: sourceCase.lac ?? null,
      fluvial: sourceCase.fluvial ?? null,
      terrain_cat: null,
      terrain_type: null,
      colline: null,
      relief: null,
      peuple: null,
      faction: null,
      controleur: null,
      controle_type: null,
      controle_principal_type: null,
      controle_principal_id: null,
      controle_secondaire_type: null,
      controle_secondaire_id: null,
      meta: createEmptyPublicMeta(),
    },
    terrain: {
      terrain_cat: draft.terrain.terrain_cat || null,
      terrain_type: draft.terrain.terrain_type || null,
      terrain_secondaire: draft.terrain.terrain_secondaire || null,
      colline: null,
      relief: draft.terrain.relief || null,
      meta: createEmptyPublicMeta(),
    },
    control: {
      peuple: draft.control.peuple || null,
      faction: draft.control.faction || null,
      controleur: draft.control.controleur || null,
      controle_type: draft.control.controle_type || null,
      controle_principal_type: draft.control.controle_principal_type || null,
      controle_principal_id: draft.control.controle_principal_id || null,
      controle_secondaire_type: draft.control.controle_secondaire_type || null,
      controle_secondaire_id: draft.control.controle_secondaire_id || null,
      meta: createEmptyPublicMeta(),
    },
    emplacements: {
      available: false,
      reason: "calcul indisponible : terrain principal non renseigné",
      modifiers: [],
    },
    bonus_contextuels: [],
    dynamic_sections: dynamicSections,
    reference_data: referenceData,
  };
}

async function mapCaseLookupRow(
  client: PoolClient,
  row: CaseLookupRow,
  sourceCase: StableCaseProperties,
): Promise<AdminCaseRecord> {
  const [dynamicSections, referenceData, bonusContextuels] = await Promise.all([
    getDynamicCaseSectionsForCase(client, row.id_case),
    getStaticAdminReferenceData(client),
    listCaseContextualBonuses(client, row.id_case),
  ]);
  const emplacements = await calculateSlotsForCase(client, row.id_case, {
    terrain_type: row.terrain_type,
    cote: row.cote ?? sourceCase.cote ?? null,
    lac: row.lac ?? sourceCase.lac ?? null,
    fluvial: row.fluvial ?? sourceCase.fluvial ?? null,
    colline: row.colline,
  });

  return {
    id_case: row.id_case,
    public: {
      registry_id_case: row.id_case,
      id_case: row.public_id_case ?? sourceCase.id_case,
      region: row.region ?? sourceCase.region ?? null,
      sous_region: row.sous_region ?? sourceCase.sous_region ?? null,
      cote: row.cote ?? sourceCase.cote ?? null,
      lac: row.lac ?? sourceCase.lac ?? null,
      fluvial: row.fluvial ?? sourceCase.fluvial ?? null,
      terrain_cat: row.terrain_cat,
      terrain_type: row.terrain_type,
      colline: row.colline,
      relief: row.relief,
      peuple: row.peuple,
      faction: row.faction,
      controleur: row.controleur,
      controle_type: row.controle_type,
      controle_principal_type: row.controle_principal_type,
      controle_principal_id: row.controle_principal_id,
      controle_secondaire_type: row.controle_secondaire_type,
      controle_secondaire_id: row.controle_secondaire_id,
      meta: {
        updated_at: toIsoStringOrNull(row.public_updated_at),
        updated_by: row.public_updated_by,
      },
    },
    terrain: {
      terrain_cat: row.terrain_cat,
      terrain_type: row.terrain_type,
      terrain_secondaire: row.terrain_secondaire,
      colline: row.colline,
      relief: row.relief,
      meta: {
        updated_at: toIsoStringOrNull(row.terrain_updated_at),
        updated_by: row.terrain_updated_by,
      },
    },
    control: {
      peuple: row.peuple,
      faction: row.faction,
      controleur: row.controleur,
      controle_type: row.controle_type,
      controle_principal_type: row.controle_principal_type,
      controle_principal_id: row.controle_principal_id,
      controle_secondaire_type: row.controle_secondaire_type,
      controle_secondaire_id: row.controle_secondaire_id,
      meta: {
        updated_at: toIsoStringOrNull(row.control_updated_at),
        updated_by: row.control_updated_by,
      },
    },
    emplacements,
    bonus_contextuels: bonusContextuels,
    dynamic_sections: dynamicSections,
    reference_data: referenceData,
  };
}

async function ensureCaseExists(
  client: PoolClient,
  idCase: string,
): Promise<void> {
  const result = await client.query<{ id_case: string }>(
    `
      SELECT id_case
      FROM case_registry
      WHERE id_case = $1
    `,
    [idCase],
  );

  if (result.rowCount === 0) {
    throw new AdminCaseNotFoundError(idCase);
  }
}

async function ensureCasesExist(
  client: PoolClient,
  idCases: string[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(idCases));
  const result = await client.query<{ id_case: string }>(
    `
      SELECT id_case
      FROM case_registry
      WHERE id_case = ANY($1::text[])
    `,
    [uniqueIds],
  );

  if (result.rowCount !== uniqueIds.length) {
    const existingIds = new Set(result.rows.map((row) => row.id_case));
    const missingId = uniqueIds.find((idCase) => !existingIds.has(idCase));

    throw new AdminCaseNotFoundError(missingId ?? uniqueIds[0] ?? "inconnue");
  }
}

async function applyCurrentSectionPatch(
  client: PoolClient,
  tableName:
    | "case_public_current"
    | "case_terrain_current"
    | "case_control_current",
  idCase: string,
  patch: EditableSectionPatch,
  userId: number,
): Promise<void> {
  const entries = getPresentEntries(patch);

  if (entries.length === 0) {
    return;
  }

  const columnNames = entries.map(([columnName]) => columnName);
  const values = entries.map(([, value]) => value);
  const insertColumns = ["id_case", ...columnNames, "updated_by_user_id"];
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
  const updateAssignments = [
    ...columnNames.map(
      (columnName) => `${columnName} = EXCLUDED.${columnName}`,
    ),
    "updated_by_user_id = EXCLUDED.updated_by_user_id",
    "updated_at = NOW()",
  ];

  await client.query(
    `
      INSERT INTO ${tableName} (${insertColumns.join(", ")})
      VALUES (${placeholders.join(", ")})
      ON CONFLICT (id_case) DO UPDATE
      SET ${updateAssignments.join(", ")}
    `,
    [idCase, ...values, userId],
  );
}

async function selectAdminCaseRecord(
  client: PoolClient,
  idCase: string,
): Promise<AdminCaseRecord> {
  await ensureCaseExists(client, idCase);

  const stableCaseIndex = await loadStableCaseIndex();
  const sourceCase =
    stableCaseIndex.get(idCase) ?? createSourceFallback(idCase);

  const result = await client.query<CaseLookupRow>(
    `
      SELECT
        registry.id_case,
        public_current.public_id_case,
        public_current.region,
        public_current.sous_region,
        public_current.cote,
        public_current.lac,
        public_current.fluvial,
        public_current.updated_at AS public_updated_at,
        public_user.username AS public_updated_by,
        terrain.terrain_cat,
        terrain.terrain_type,
        terrain.terrain_secondaire,
        terrain.colline,
        terrain.relief,
        terrain.updated_at AS terrain_updated_at,
        terrain_user.username AS terrain_updated_by,
        control_current.peuple,
        control_current.faction,
        control_current.controleur,
        control_current.controle_type,
        control_current.controle_principal_type,
        control_current.controle_principal_id,
        control_current.controle_secondaire_type,
        control_current.controle_secondaire_id,
        control_current.updated_at AS control_updated_at,
        control_user.username AS control_updated_by
      FROM case_registry AS registry
      LEFT JOIN case_public_current AS public_current ON public_current.id_case = registry.id_case
      LEFT JOIN staff_users AS public_user ON public_user.id = public_current.updated_by_user_id
      LEFT JOIN case_terrain_current AS terrain ON terrain.id_case = registry.id_case
      LEFT JOIN staff_users AS terrain_user ON terrain_user.id = terrain.updated_by_user_id
      LEFT JOIN case_control_current AS control_current ON control_current.id_case = registry.id_case
      LEFT JOIN staff_users AS control_user ON control_user.id = control_current.updated_by_user_id
      WHERE registry.id_case = $1
    `,
    [idCase],
  );

  return result.rows[0]
    ? await mapCaseLookupRow(client, result.rows[0], sourceCase)
    : await createEmptyAdminRecord(client, idCase, sourceCase);
}

export async function getAdminCaseRecord(
  idCase: string,
): Promise<AdminCaseRecord> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    return await selectAdminCaseRecord(client, idCase);
  } finally {
    client.release();
  }
}

export async function saveAdminCaseRecord(
  idCase: string,
  draft: AdminCaseDraft,
  userId: number,
): Promise<AdminCaseRecord> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await ensureCaseExists(client, idCase);
    await validateStaticAdminDraftSelections(client, draft);

    await applyCurrentSectionPatch(
      client,
      "case_public_current",
      idCase,
      {
        public_id_case: normalizePublicId(draft.public.id_case, idCase),
        region: normalizeNullableField(draft.public.region),
        sous_region: normalizeNullableField(draft.public.sous_region),
        cote:
          draft.public.cote.length > 0 ? draft.public.cote === "true" : null,
        lac: draft.public.lac.length > 0 ? draft.public.lac === "true" : null,
        fluvial:
          draft.public.fluvial.length > 0
            ? draft.public.fluvial === "true"
            : null,
      },
      userId,
    );

    await applyCurrentSectionPatch(
      client,
      "case_terrain_current",
      idCase,
      {
        terrain_cat: normalizeNullableField(draft.terrain.terrain_cat),
        terrain_type: normalizeNullableField(draft.terrain.terrain_type),
        terrain_secondaire: normalizeNullableField(
          draft.terrain.terrain_secondaire,
        ),
        colline:
          draft.terrain.colline.length > 0
            ? draft.terrain.colline === "true"
            : null,
        relief: normalizeNullableField(draft.terrain.relief),
      },
      userId,
    );

    await applyCurrentSectionPatch(
      client,
      "case_control_current",
      idCase,
      {
        faction: normalizeNullableField(draft.control.faction),
        controleur: normalizeNullableField(draft.control.controleur),
        controle_type: normalizeNullableField(draft.control.controle_type),
        controle_principal_type: normalizeNullableField(
          draft.control.controle_principal_type,
        ),
        controle_principal_id: normalizeNullableField(
          draft.control.controle_principal_id,
        ),
        controle_secondaire_type: normalizeNullableField(
          draft.control.controle_secondaire_type,
        ),
        controle_secondaire_id: normalizeNullableField(
          draft.control.controle_secondaire_id,
        ),
        peuple: normalizeNullableField(draft.control.peuple),
      },
      userId,
    );

    await saveDynamicSectionsForCase(client, idCase, draft.dynamic, userId);
    if (draft.bonus_contextuels !== undefined) {
      await replaceCaseContextualBonuses(
        client,
        idCase,
        draft.bonus_contextuels,
      );
    }

    const record = await selectAdminCaseRecord(client, idCase);
    await persistSlotCalculation(client, idCase, record.emplacements, userId);
    await client.query("COMMIT");

    return record;
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new Error("La valeur du champ id_case est deja utilisee.");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function saveAdminCaseBulkPatch(
  idCases: string[],
  patch: AdminBulkPatch,
  userId: number,
): Promise<AdminBulkUpdateResult> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const uniqueIds = Array.from(
    new Set(idCases.filter((idCase) => idCase.trim().length > 0)),
  );

  if (uniqueIds.length === 0) {
    throw new Error("Aucune case n'a ete fournie pour l'edition de masse.");
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await ensureCasesExist(client, uniqueIds);
    await validateStaticBulkPatchSelections(client, patch);

    for (const idCase of uniqueIds) {
      if (patch.public) {
        await applyCurrentSectionPatch(
          client,
          "case_public_current",
          idCase,
          patch.public,
          userId,
        );
      }

      if (patch.terrain) {
        await applyCurrentSectionPatch(
          client,
          "case_terrain_current",
          idCase,
          patch.terrain,
          userId,
        );
      }

      if (patch.control) {
        await applyCurrentSectionPatch(
          client,
          "case_control_current",
          idCase,
          patch.control,
          userId,
        );
      }

      if (patch.bonus_contextuels) {
        await replaceCaseContextualBonuses(
          client,
          idCase,
          patch.bonus_contextuels,
        );
      }

      const record = await selectAdminCaseRecord(client, idCase);
      await persistSlotCalculation(client, idCase, record.emplacements, userId);
    }

    await client.query("COMMIT");

    return {
      updated_count: uniqueIds.length,
      id_cases: uniqueIds,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
