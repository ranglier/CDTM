import type { PublicCaseIndexResponse, PublicCaseProperties } from "@/admin/types";
import { listPublicMapStyles } from "@/server/admin-tech-repository";
import { ensureDatabaseReady, getPool } from "@/server/db";
import { loadStableCaseIndex } from "@/server/stable-case-source";

type PublicCaseRow = {
  id_case: string;
  public_id_case: string | null;
  region: string | null;
  sous_region: string | null;
  cote: boolean | null;
  lac_majeur: boolean | null;
  cours_eau_majeur: boolean | null;
  terrain_cat: string | null;
  terrain_type: string | null;
  relief: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
};

function createEmptyPublicCase(idCase: string): PublicCaseProperties {
  return {
    registry_id_case: idCase,
    id_case: idCase,
    region: null,
    sous_region: null,
    cote: null,
    lac_majeur: null,
    cours_eau_majeur: null,
    terrain_cat: null,
    terrain_type: null,
    relief: null,
    faction: null,
    controleur: null,
    controle_type: null,
  };
}

function mergePublicCase(row: PublicCaseRow, fallback: PublicCaseProperties): PublicCaseProperties {
  return {
    registry_id_case: row.id_case,
    id_case: row.public_id_case ?? fallback.id_case,
    region: row.region ?? fallback.region,
    sous_region: row.sous_region ?? fallback.sous_region,
    cote: row.cote ?? fallback.cote,
    lac_majeur: row.lac_majeur ?? fallback.lac_majeur,
    cours_eau_majeur: row.cours_eau_majeur ?? fallback.cours_eau_majeur,
    terrain_cat: row.terrain_cat,
    terrain_type: row.terrain_type,
    relief: row.relief,
    faction: row.faction,
    controleur: row.controleur,
    controle_type: row.controle_type,
  };
}

export async function getPublicCaseIndex(): Promise<PublicCaseProperties[]> {
  const stableCaseIndex = await loadStableCaseIndex();
  const fallbackCases = Array.from(stableCaseIndex.values()).map((stableCase) => ({
    registry_id_case: stableCase.registry_id_case ?? stableCase.id_case,
    id_case: stableCase.id_case,
    region: stableCase.region ?? null,
    sous_region: stableCase.sous_region ?? null,
    cote: stableCase.cote ?? null,
    lac_majeur: stableCase.lac_majeur ?? null,
    cours_eau_majeur: stableCase.cours_eau_majeur ?? null,
    terrain_cat: null,
    terrain_type: null,
    relief: null,
    faction: null,
    controleur: null,
    controle_type: null,
  }));

  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return fallbackCases;
  }

  const result = await getPool().query<PublicCaseRow>(
    `
      SELECT
        registry.id_case,
        public_current.public_id_case,
        public_current.region,
        public_current.sous_region,
        public_current.cote,
        public_current.lac_majeur,
        public_current.cours_eau_majeur,
        terrain.terrain_cat,
        terrain.terrain_type,
        terrain.relief,
        control_current.faction,
        control_current.controleur,
        control_current.controle_type
      FROM case_registry AS registry
      LEFT JOIN case_public_current AS public_current ON public_current.id_case = registry.id_case
      LEFT JOIN case_terrain_current AS terrain ON terrain.id_case = registry.id_case
      LEFT JOIN case_control_current AS control_current ON control_current.id_case = registry.id_case
      ORDER BY registry.id_case
    `,
  );

  return result.rows.map((row) => {
    const stableCase = stableCaseIndex.get(row.id_case);
    const fallback = stableCase
      ? {
          registry_id_case: stableCase.registry_id_case ?? stableCase.id_case,
          id_case: stableCase.id_case,
          region: stableCase.region ?? null,
          sous_region: stableCase.sous_region ?? null,
          cote: stableCase.cote ?? null,
          lac_majeur: stableCase.lac_majeur ?? null,
          cours_eau_majeur: stableCase.cours_eau_majeur ?? null,
          terrain_cat: null,
          terrain_type: null,
          relief: null,
          faction: null,
          controleur: null,
          controle_type: null,
        }
      : createEmptyPublicCase(row.id_case);

    return mergePublicCase(row, fallback);
  });
}

export async function getPublicCaseIndexResponse(): Promise<PublicCaseIndexResponse> {
  const [cases, styles] = await Promise.all([getPublicCaseIndex(), listPublicMapStyles()]);

  return {
    cases,
    styles,
  };
}
