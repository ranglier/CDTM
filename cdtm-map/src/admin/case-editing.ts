import {
  createEmptyAdminBulkEditDraft,
  createEmptyAdminCaseDraft,
  toAdminCaseDraft,
  type AdminBulkEditDraft,
  type AdminBulkPatch,
  type AdminCaseDraft,
  type AdminCaseRecord,
  type AdminSession,
  type PublicCaseProperties,
} from "@/admin/types";
import { getRegistryCaseId, mergeStableCases } from "@/map/case-data";
import type { StableCaseProperties } from "@/map/types";

type StaticAdminDraftSection = Exclude<keyof AdminCaseDraft, "dynamic">;

export function createLoggedOutSession(): AdminSession {
  return {
    authenticated: false,
    username: null,
    role: null,
    is_tech_admin: false,
  };
}

export function resolveCaseSearchMatch(
  stableCases: StableCaseProperties[],
  rawQuery: string,
): StableCaseProperties | null {
  const query = rawQuery.trim().toLowerCase();

  if (query.length === 0) {
    return null;
  }

  const exactMatch =
    stableCases.find(
      (stableCase) => stableCase.id_case.toLowerCase() === query,
    ) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = stableCases.filter((stableCase) =>
    stableCase.id_case.toLowerCase().startsWith(query),
  );

  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

export function getDraftSnapshot(draft: AdminCaseDraft): string {
  return JSON.stringify(draft);
}

export function normalizeDraftValue(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

export function normalizeDraftBooleanValue(
  value: boolean | null | undefined,
): string {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

export function parseDraftBooleanValue(value: string): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export function mergePublicCasesIntoStableCases(
  baseCases: StableCaseProperties[],
  publicCases: PublicCaseProperties[],
): StableCaseProperties[] {
  return mergeStableCases(baseCases, publicCases);
}

export function applyPersistedRecordToStableCase(
  stableCase: StableCaseProperties,
  record: AdminCaseRecord,
): StableCaseProperties {
  return {
    registry_id_case: getRegistryCaseId(stableCase),
    id_case: record.public.id_case,
    region: record.public.region,
    sous_region: record.public.sous_region,
    cote: record.public.cote,
    lac: record.public.lac,
    fluvial: record.public.fluvial,
    terrain_cat: record.public.terrain_cat,
    terrain_type: record.public.terrain_type,
    colline: record.public.colline,
    relief: record.public.relief,
    peuple: record.public.peuple,
    faction: record.public.faction,
    controleur: record.public.controleur,
    controle_type: record.public.controle_type,
    controle_principal_type: record.public.controle_principal_type,
    controle_principal_id: record.public.controle_principal_id,
    controle_secondaire_type: record.public.controle_secondaire_type,
    controle_secondaire_id: record.public.controle_secondaire_id,
  };
}

export function mergePersistedRecordsIntoStableCases(
  stableCases: StableCaseProperties[],
  records: AdminCaseRecord[],
): StableCaseProperties[] {
  const recordsByRegistryId = new Map(
    records.map((record) => [record.id_case, record]),
  );

  return stableCases.map((stableCase) => {
    const record = recordsByRegistryId.get(getRegistryCaseId(stableCase));
    return record
      ? applyPersistedRecordToStableCase(stableCase, record)
      : stableCase;
  });
}

export function hasBulkDraftChanges(draft: AdminBulkEditDraft): boolean {
  return (
    [
      draft.public.region,
      draft.public.sous_region,
      draft.public.cote,
      draft.public.lac,
      draft.public.fluvial,
      draft.terrain.terrain_cat,
      draft.terrain.terrain_type,
      draft.terrain.terrain_secondaire,
      draft.terrain.colline,
      draft.terrain.relief,
      draft.control.peuple,
      draft.control.faction,
      draft.control.controleur,
      draft.control.controle_type,
      draft.control.controle_principal_type,
      draft.control.controle_principal_id,
      draft.control.controle_secondaire_type,
      draft.control.controle_secondaire_id,
    ].some((fieldState) => fieldState.touched) ||
    draft.bonus_contextuels.touched
  );
}

function buildBulkFieldState(values: Array<string | null | undefined>) {
  const normalizedValues = values.map((value) =>
    normalizeDraftValue(value).trim(),
  );
  const uniqueValues = Array.from(new Set(normalizedValues));

  return {
    value: uniqueValues.length === 1 ? uniqueValues[0] : "",
    touched: false,
    mixed: uniqueValues.length > 1,
  };
}

export function normalizeSlugList(values: string[]): string[] {
  return Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  ).sort();
}

function getSlugListKey(values: string[]): string {
  return normalizeSlugList(values).join("\u0000");
}

function buildBulkListState(values: string[][]) {
  const normalizedValues = values.map(normalizeSlugList);
  const uniqueKeys = Array.from(new Set(normalizedValues.map(getSlugListKey)));

  return {
    value: uniqueKeys.length === 1 ? normalizedValues[0] : [],
    touched: false,
    mixed: uniqueKeys.length > 1,
  };
}

export function buildBulkEditDraft(
  records: AdminCaseRecord[],
): AdminBulkEditDraft {
  if (records.length === 0) {
    return createEmptyAdminBulkEditDraft();
  }

  return {
    public: {
      region: buildBulkFieldState(
        records.map((record) => record.public.region),
      ),
      sous_region: buildBulkFieldState(
        records.map((record) => record.public.sous_region),
      ),
      cote: buildBulkFieldState(
        records.map((record) => normalizeDraftBooleanValue(record.public.cote)),
      ),
      lac: buildBulkFieldState(
        records.map((record) => normalizeDraftBooleanValue(record.public.lac)),
      ),
      fluvial: buildBulkFieldState(
        records.map((record) =>
          normalizeDraftBooleanValue(record.public.fluvial),
        ),
      ),
    },
    terrain: {
      terrain_cat: buildBulkFieldState(
        records.map((record) => record.terrain.terrain_cat),
      ),
      terrain_type: buildBulkFieldState(
        records.map((record) => record.terrain.terrain_type),
      ),
      terrain_secondaire: buildBulkFieldState(
        records.map((record) => record.terrain.terrain_secondaire),
      ),
      colline: buildBulkFieldState(
        records.map((record) =>
          normalizeDraftBooleanValue(record.terrain.colline),
        ),
      ),
      relief: buildBulkFieldState(
        records.map((record) => record.terrain.relief),
      ),
    },
    control: {
      peuple: buildBulkFieldState(
        records.map((record) => record.control.peuple),
      ),
      faction: buildBulkFieldState(
        records.map((record) => record.control.faction),
      ),
      controleur: buildBulkFieldState(
        records.map((record) => record.control.controleur),
      ),
      controle_type: buildBulkFieldState(
        records.map((record) => record.control.controle_type),
      ),
      controle_principal_type: buildBulkFieldState(
        records.map((record) => record.control.controle_principal_type),
      ),
      controle_principal_id: buildBulkFieldState(
        records.map((record) => record.control.controle_principal_id),
      ),
      controle_secondaire_type: buildBulkFieldState(
        records.map((record) => record.control.controle_secondaire_type),
      ),
      controle_secondaire_id: buildBulkFieldState(
        records.map((record) => record.control.controle_secondaire_id),
      ),
    },
    bonus_contextuels: buildBulkListState(
      records.map((record) =>
        record.bonus_contextuels.map((bonus) => bonus.slug),
      ),
    ),
  };
}

export function buildBulkPatch(draft: AdminBulkEditDraft): AdminBulkPatch {
  const patch: AdminBulkPatch = {};

  if (
    draft.public.region.touched ||
    draft.public.sous_region.touched ||
    draft.public.cote.touched ||
    draft.public.lac.touched ||
    draft.public.fluvial.touched
  ) {
    patch.public = {};

    if (draft.public.region.touched) {
      patch.public.region =
        draft.public.region.value.trim().length > 0
          ? draft.public.region.value.trim()
          : null;
    }

    if (draft.public.sous_region.touched) {
      patch.public.sous_region =
        draft.public.sous_region.value.trim().length > 0
          ? draft.public.sous_region.value.trim()
          : null;
    }

    if (draft.public.cote.touched) {
      patch.public.cote = parseDraftBooleanValue(draft.public.cote.value);
    }

    if (draft.public.lac.touched) {
      patch.public.lac = parseDraftBooleanValue(draft.public.lac.value);
    }

    if (draft.public.fluvial.touched) {
      patch.public.fluvial = parseDraftBooleanValue(draft.public.fluvial.value);
    }
  }

  if (
    draft.terrain.terrain_cat.touched ||
    draft.terrain.terrain_type.touched ||
    draft.terrain.terrain_secondaire.touched ||
    draft.terrain.colline.touched ||
    draft.terrain.relief.touched
  ) {
    patch.terrain = {};

    if (draft.terrain.terrain_cat.touched) {
      patch.terrain.terrain_cat =
        draft.terrain.terrain_cat.value.trim().length > 0
          ? draft.terrain.terrain_cat.value.trim()
          : null;
    }

    if (draft.terrain.terrain_type.touched) {
      patch.terrain.terrain_type =
        draft.terrain.terrain_type.value.trim().length > 0
          ? draft.terrain.terrain_type.value.trim()
          : null;
    }

    if (draft.terrain.terrain_secondaire.touched) {
      patch.terrain.terrain_secondaire =
        draft.terrain.terrain_secondaire.value.trim().length > 0
          ? draft.terrain.terrain_secondaire.value.trim()
          : null;
    }

    if (draft.terrain.colline.touched) {
      patch.terrain.colline = parseDraftBooleanValue(
        draft.terrain.colline.value,
      );
    }

    if (draft.terrain.relief.touched) {
      patch.terrain.relief =
        draft.terrain.relief.value.trim().length > 0
          ? draft.terrain.relief.value.trim()
          : null;
    }
  }

  if (
    draft.control.peuple.touched ||
    draft.control.faction.touched ||
    draft.control.controleur.touched ||
    draft.control.controle_type.touched ||
    draft.control.controle_principal_type.touched ||
    draft.control.controle_principal_id.touched ||
    draft.control.controle_secondaire_type.touched ||
    draft.control.controle_secondaire_id.touched
  ) {
    patch.control = {};

    if (draft.control.peuple.touched) {
      patch.control.peuple =
        draft.control.peuple.value.trim().length > 0
          ? draft.control.peuple.value.trim()
          : null;
    }

    if (draft.control.faction.touched) {
      patch.control.faction =
        draft.control.faction.value.trim().length > 0
          ? draft.control.faction.value.trim()
          : null;
    }

    if (draft.control.controleur.touched) {
      patch.control.controleur =
        draft.control.controleur.value.trim().length > 0
          ? draft.control.controleur.value.trim()
          : null;
    }

    if (draft.control.controle_type.touched) {
      patch.control.controle_type =
        draft.control.controle_type.value.trim().length > 0
          ? draft.control.controle_type.value.trim()
          : null;
    }

    if (draft.control.controle_principal_type.touched) {
      patch.control.controle_principal_type =
        draft.control.controle_principal_type.value.trim().length > 0
          ? draft.control.controle_principal_type.value.trim()
          : null;
    }

    if (draft.control.controle_principal_id.touched) {
      patch.control.controle_principal_id =
        draft.control.controle_principal_id.value.trim().length > 0
          ? draft.control.controle_principal_id.value.trim()
          : null;
    }

    if (draft.control.controle_secondaire_type.touched) {
      patch.control.controle_secondaire_type =
        draft.control.controle_secondaire_type.value.trim().length > 0
          ? draft.control.controle_secondaire_type.value.trim()
          : null;
    }

    if (draft.control.controle_secondaire_id.touched) {
      patch.control.controle_secondaire_id =
        draft.control.controle_secondaire_id.value.trim().length > 0
          ? draft.control.controle_secondaire_id.value.trim()
          : null;
    }
  }

  if (draft.bonus_contextuels.touched) {
    patch.bonus_contextuels = normalizeSlugList(draft.bonus_contextuels.value);
  }

  return patch;
}

export function createSingleAdminDraft(
  record: AdminCaseRecord | null,
  stableCase: StableCaseProperties | null,
): AdminCaseDraft {
  const nextDraft = toAdminCaseDraft(record);

  if (stableCase) {
    nextDraft.public = {
      id_case: stableCase.id_case,
      region: stableCase.region ?? "",
      sous_region: stableCase.sous_region ?? "",
      cote: normalizeDraftBooleanValue(stableCase.cote),
      lac: normalizeDraftBooleanValue(stableCase.lac),
      fluvial: normalizeDraftBooleanValue(stableCase.fluvial),
    };
  }

  return nextDraft;
}

export function updateSingleAdminDraftField(
  draft: AdminCaseDraft,
  section: StaticAdminDraftSection,
  field: string,
  value: string,
): AdminCaseDraft {
  const nextDraft = {
    ...draft,
    [section]: {
      ...draft[section],
      [field]: value,
    },
  } as AdminCaseDraft;

  if (section === "terrain" && field === "terrain_cat") {
    nextDraft.terrain = {
      ...nextDraft.terrain,
      terrain_type: "",
    };
  }

  if (section === "control" && field === "controle_principal_type") {
    nextDraft.control = {
      ...nextDraft.control,
      controle_principal_id: "",
    };
  }

  if (section === "control" && field === "controle_secondaire_type") {
    nextDraft.control = {
      ...nextDraft.control,
      controle_secondaire_id: "",
    };
  }

  return nextDraft;
}

export function updateSingleDynamicAdminDraftField(
  draft: AdminCaseDraft,
  tableKey: string,
  field: string,
  value: string,
): AdminCaseDraft {
  return {
    ...draft,
    dynamic: {
      ...draft.dynamic,
      [tableKey]: {
        ...(draft.dynamic[tableKey] ?? {}),
        [field]: value,
      },
    },
  };
}

export function updateSingleBonusContextuelsDraft(
  draft: AdminCaseDraft,
  bonusSlugs: string[],
): AdminCaseDraft {
  return {
    ...draft,
    bonus_contextuels: normalizeSlugList(bonusSlugs),
  };
}

export function updateBulkAdminDraftField(
  draft: AdminBulkEditDraft,
  section: keyof AdminBulkEditDraft,
  field: string,
  value: string,
): AdminBulkEditDraft {
  const nextDraft = {
    ...draft,
    [section]: {
      ...draft[section],
      [field]: {
        ...(
          draft[section] as Record<
            string,
            { value: string; touched: boolean; mixed: boolean }
          >
        )[field],
        value,
        touched: true,
        mixed: false,
      },
    },
  } as AdminBulkEditDraft;

  if (section === "terrain" && field === "terrain_cat") {
    nextDraft.terrain.terrain_type = {
      ...nextDraft.terrain.terrain_type,
      value: "",
      touched: true,
      mixed: false,
    };
  }

  if (
    section === "terrain" &&
    field === "terrain_type" &&
    !nextDraft.terrain.terrain_cat.touched
  ) {
    nextDraft.terrain.terrain_cat = {
      ...nextDraft.terrain.terrain_cat,
      touched: true,
      mixed: false,
    };
  }

  if (section === "control" && field === "controle_principal_type") {
    nextDraft.control.controle_principal_id = {
      ...nextDraft.control.controle_principal_id,
      value: "",
      touched: true,
      mixed: false,
    };
  }

  if (section === "control" && field === "controle_secondaire_type") {
    nextDraft.control.controle_secondaire_id = {
      ...nextDraft.control.controle_secondaire_id,
      value: "",
      touched: true,
      mixed: false,
    };
  }

  return nextDraft;
}

export function updateBulkBonusContextuelsDraft(
  draft: AdminBulkEditDraft,
  bonusSlugs: string[],
): AdminBulkEditDraft {
  return {
    ...draft,
    bonus_contextuels: {
      value: normalizeSlugList(bonusSlugs),
      touched: true,
      mixed: false,
    },
  };
}

export function createEmptySingleAdminDraft(): AdminCaseDraft {
  return createEmptyAdminCaseDraft();
}
