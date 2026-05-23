import type { PoolClient } from "pg";

import {
  type AdminBulkPatch,
  type AdminBulkUpdateResult,
  createEmptyAdminCaseDraft,
  type AdminCaseDraft,
  type AdminCaseRecord,
} from "@/admin/types";
import type { StableCaseProperties } from "@/map/types";
import {
  ensureDatabaseReady,
  getPool,
} from "@/server/db";
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
  lac_majeur: boolean | null;
  cours_eau_majeur: boolean | null;
  public_updated_at: string | null;
  public_updated_by: string | null;
  note_publique: string | null;
  note_staff: string | null;
  notes_updated_at: string | null;
  notes_updated_by: string | null;
  terrain_cat: string | null;
  terrain_type: string | null;
  relief: string | null;
  terrain_updated_at: string | null;
  terrain_updated_by: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
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
    lac_majeur: null,
    cours_eau_majeur: null,
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

      return Object.prototype.hasOwnProperty.call(value, key) && currentValue !== undefined;
    },
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
      lac_majeur: sourceCase.lac_majeur ?? null,
      cours_eau_majeur: sourceCase.cours_eau_majeur ?? null,
      terrain_cat: null,
      terrain_type: null,
      relief: null,
      faction: null,
      controleur: null,
      controle_type: null,
      meta: createEmptyPublicMeta(),
    },
    notes: {
      note_publique: draft.notes.note_publique || null,
      note_staff: draft.notes.note_staff || null,
      meta: createEmptyPublicMeta(),
    },
    terrain: {
      terrain_cat: draft.terrain.terrain_cat || null,
      terrain_type: draft.terrain.terrain_type || null,
      relief: draft.terrain.relief || null,
      meta: createEmptyPublicMeta(),
    },
    control: {
      faction: draft.control.faction || null,
      controleur: draft.control.controleur || null,
      controle_type: draft.control.controle_type || null,
      meta: createEmptyPublicMeta(),
    },
    dynamic_sections: dynamicSections,
    reference_data: referenceData,
  };
}

async function mapCaseLookupRow(
  client: PoolClient,
  row: CaseLookupRow,
  sourceCase: StableCaseProperties,
): Promise<AdminCaseRecord> {
  const [dynamicSections, referenceData] = await Promise.all([
    getDynamicCaseSectionsForCase(client, row.id_case),
    getStaticAdminReferenceData(client),
  ]);

  return {
    id_case: row.id_case,
    public: {
      registry_id_case: row.id_case,
      id_case: row.public_id_case ?? sourceCase.id_case,
      region: row.region ?? sourceCase.region ?? null,
      sous_region: row.sous_region ?? sourceCase.sous_region ?? null,
      cote: row.cote ?? sourceCase.cote ?? null,
      lac_majeur: row.lac_majeur ?? sourceCase.lac_majeur ?? null,
      cours_eau_majeur: row.cours_eau_majeur ?? sourceCase.cours_eau_majeur ?? null,
      terrain_cat: row.terrain_cat,
      terrain_type: row.terrain_type,
      relief: row.relief,
      faction: row.faction,
      controleur: row.controleur,
      controle_type: row.controle_type,
      meta: {
        updated_at: toIsoStringOrNull(row.public_updated_at),
        updated_by: row.public_updated_by,
      },
    },
    notes: {
      note_publique: row.note_publique,
      note_staff: row.note_staff,
      meta: {
        updated_at: toIsoStringOrNull(row.notes_updated_at),
        updated_by: row.notes_updated_by,
      },
    },
    terrain: {
      terrain_cat: row.terrain_cat,
      terrain_type: row.terrain_type,
      relief: row.relief,
      meta: {
        updated_at: toIsoStringOrNull(row.terrain_updated_at),
        updated_by: row.terrain_updated_by,
      },
    },
    control: {
      faction: row.faction,
      controleur: row.controleur,
      controle_type: row.controle_type,
      meta: {
        updated_at: toIsoStringOrNull(row.control_updated_at),
        updated_by: row.control_updated_by,
      },
    },
    dynamic_sections: dynamicSections,
    reference_data: referenceData,
  };
}

async function ensureCaseExists(client: PoolClient, idCase: string): Promise<void> {
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

async function ensureCasesExist(client: PoolClient, idCases: string[]): Promise<void> {
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
    | "case_notes_current"
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
    ...columnNames.map((columnName) => `${columnName} = EXCLUDED.${columnName}`),
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

async function selectAdminCaseRecord(client: PoolClient, idCase: string): Promise<AdminCaseRecord> {
  await ensureCaseExists(client, idCase);

  const stableCaseIndex = await loadStableCaseIndex();
  const sourceCase = stableCaseIndex.get(idCase) ?? createSourceFallback(idCase);

  const result = await client.query<CaseLookupRow>(
    `
      SELECT
        registry.id_case,
        public_current.public_id_case,
        public_current.region,
        public_current.sous_region,
        public_current.cote,
        public_current.lac_majeur,
        public_current.cours_eau_majeur,
        public_current.updated_at AS public_updated_at,
        public_user.username AS public_updated_by,
        notes.note_publique,
        notes.note_staff,
        notes.updated_at AS notes_updated_at,
        notes_user.username AS notes_updated_by,
        terrain.terrain_cat,
        terrain.terrain_type,
        terrain.relief,
        terrain.updated_at AS terrain_updated_at,
        terrain_user.username AS terrain_updated_by,
        control_current.faction,
        control_current.controleur,
        control_current.controle_type,
        control_current.updated_at AS control_updated_at,
        control_user.username AS control_updated_by
      FROM case_registry AS registry
      LEFT JOIN case_public_current AS public_current ON public_current.id_case = registry.id_case
      LEFT JOIN staff_users AS public_user ON public_user.id = public_current.updated_by_user_id
      LEFT JOIN case_notes_current AS notes ON notes.id_case = registry.id_case
      LEFT JOIN staff_users AS notes_user ON notes_user.id = notes.updated_by_user_id
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

export async function getAdminCaseRecord(idCase: string): Promise<AdminCaseRecord> {
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
        cote: draft.public.cote.length > 0 ? draft.public.cote === "true" : null,
        lac_majeur:
          draft.public.lac_majeur.length > 0 ? draft.public.lac_majeur === "true" : null,
        cours_eau_majeur:
          draft.public.cours_eau_majeur.length > 0
            ? draft.public.cours_eau_majeur === "true"
            : null,
      },
      userId,
    );

    await applyCurrentSectionPatch(
      client,
      "case_notes_current",
      idCase,
      {
        note_publique: normalizeNullableField(draft.notes.note_publique),
        note_staff: normalizeNullableField(draft.notes.note_staff),
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
      },
      userId,
    );

    await saveDynamicSectionsForCase(client, idCase, draft.dynamic, userId);

    const record = await selectAdminCaseRecord(client, idCase);
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

  const uniqueIds = Array.from(new Set(idCases.filter((idCase) => idCase.trim().length > 0)));

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
        await applyCurrentSectionPatch(client, "case_public_current", idCase, patch.public, userId);
      }

      if (patch.notes) {
        await applyCurrentSectionPatch(client, "case_notes_current", idCase, patch.notes, userId);
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
