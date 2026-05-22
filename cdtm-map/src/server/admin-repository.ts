import type { PoolClient } from "pg";

import {
  type AdminBulkPatch,
  type AdminBulkUpdateResult,
  createEmptyAdminCaseDraft,
  type AdminCaseDraft,
  type AdminCaseRecord,
  type PublicCaseSupplement,
} from "@/admin/types";
import { ensureDatabaseReady, getPool } from "@/server/db";

type CaseLookupRow = {
  id_case: string;
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

export class AdminCaseNotFoundError extends Error {
  constructor(idCase: string) {
    super(`La case ${idCase} est introuvable.`);
  }
}

function createEmptyAdminRecord(idCase: string): AdminCaseRecord {
  const draft = createEmptyAdminCaseDraft();

  return {
    id_case: idCase,
    notes: {
      note_publique: draft.notes.note_publique || null,
      note_staff: draft.notes.note_staff || null,
      meta: {
        updated_at: null,
        updated_by: null,
      },
    },
    terrain: {
      terrain_cat: draft.terrain.terrain_cat || null,
      terrain_type: draft.terrain.terrain_type || null,
      relief: draft.terrain.relief || null,
      meta: {
        updated_at: null,
        updated_by: null,
      },
    },
    control: {
      faction: draft.control.faction || null,
      controleur: draft.control.controleur || null,
      controle_type: draft.control.controle_type || null,
      meta: {
        updated_at: null,
        updated_by: null,
      },
    },
  };
}

function toIsoStringOrNull(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function mapCaseLookupRow(row: CaseLookupRow): AdminCaseRecord {
  return {
    id_case: row.id_case,
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
  };
}

function normalizeNullableField(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function getPresentEntries<T extends Record<string, string | null | undefined>>(
  value: T,
): Array<[keyof T & string, string | null]> {
  return Object.entries(value).filter((entry): entry is [keyof T & string, string | null] => {
    const [key, currentValue] = entry;

    return Object.prototype.hasOwnProperty.call(value, key) && currentValue !== undefined;
  });
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
  tableName: "case_notes_current" | "case_terrain_current" | "case_control_current",
  idCase: string,
  patch: Record<string, string | null | undefined>,
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

  const result = await client.query<CaseLookupRow>(
    `
      SELECT
        registry.id_case,
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

  return result.rows[0] ? mapCaseLookupRow(result.rows[0]) : createEmptyAdminRecord(idCase);
}

export async function getPublicCaseSupplement(idCase: string): Promise<PublicCaseSupplement> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return {
      id_case: idCase,
      note_publique: null,
    };
  }

  const result = await getPool().query<{ note_publique: string | null }>(
    `
      SELECT note_publique
      FROM case_notes_current
      WHERE id_case = $1
    `,
    [idCase],
  );

  return {
    id_case: idCase,
    note_publique: result.rows[0]?.note_publique ?? null,
  };
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

    await client.query(
      `
        INSERT INTO case_notes_current (
          id_case,
          note_publique,
          note_staff,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id_case) DO UPDATE
        SET
          note_publique = EXCLUDED.note_publique,
          note_staff = EXCLUDED.note_staff,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [
        idCase,
        normalizeNullableField(draft.notes.note_publique),
        normalizeNullableField(draft.notes.note_staff),
        userId,
      ],
    );

    await client.query(
      `
        INSERT INTO case_terrain_current (
          id_case,
          terrain_cat,
          terrain_type,
          relief,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id_case) DO UPDATE
        SET
          terrain_cat = EXCLUDED.terrain_cat,
          terrain_type = EXCLUDED.terrain_type,
          relief = EXCLUDED.relief,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [
        idCase,
        normalizeNullableField(draft.terrain.terrain_cat),
        normalizeNullableField(draft.terrain.terrain_type),
        normalizeNullableField(draft.terrain.relief),
        userId,
      ],
    );

    await client.query(
      `
        INSERT INTO case_control_current (
          id_case,
          faction,
          controleur,
          controle_type,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id_case) DO UPDATE
        SET
          faction = EXCLUDED.faction,
          controleur = EXCLUDED.controleur,
          controle_type = EXCLUDED.controle_type,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      `,
      [
        idCase,
        normalizeNullableField(draft.control.faction),
        normalizeNullableField(draft.control.controleur),
        normalizeNullableField(draft.control.controle_type),
        userId,
      ],
    );

    const record = await selectAdminCaseRecord(client, idCase);
    await client.query("COMMIT");

    return record;
  } catch (error) {
    await client.query("ROLLBACK");
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

    for (const idCase of uniqueIds) {
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
