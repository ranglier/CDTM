import {
  createEmptyAdminCaseDraft,
  type AdminBulkPatch,
  type AdminCaseDraft,
} from "@/admin/types";

const booleanDraftOptions = ["", "true", "false"] as const;

function ensurePlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Le corps de requete admin est invalide.");
  }

  return value as Record<string, unknown>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeBooleanDraftValue(value: unknown): string {
  const normalized = normalizeText(value);

  if ((booleanDraftOptions as readonly string[]).includes(normalized)) {
    return normalized;
  }

  throw new Error("La valeur d'un champ booleen est invalide.");
}

function parseNullableBooleanFromDraft(value: string | null): boolean | null {
  if (value === null || value.length === 0) {
    return null;
  }

  return value === "true";
}

function parseNullableBooleanPatchValue(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return parseNullableBooleanFromDraft(normalizeBooleanDraftValue(value));
}

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("La liste des bonus contextuels est invalide.");
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

export function parseAdminCaseDraft(value: unknown): AdminCaseDraft {
  const payload = ensurePlainObject(value);
  const emptyDraft = createEmptyAdminCaseDraft();
  const publicFields = ensurePlainObject(payload.public ?? emptyDraft.public);
  const terrain = ensurePlainObject(payload.terrain ?? emptyDraft.terrain);
  const control = ensurePlainObject(payload.control ?? emptyDraft.control);
  const dynamicSections = payload.dynamic
    ? ensurePlainObject(payload.dynamic)
    : {};

  return {
    public: {
      id_case: normalizeText(publicFields.id_case),
      region: normalizeText(publicFields.region),
      sous_region: normalizeText(publicFields.sous_region),
      cote: normalizeBooleanDraftValue(publicFields.cote),
      lac: normalizeBooleanDraftValue(publicFields.lac),
      fluvial: normalizeBooleanDraftValue(publicFields.fluvial),
    },
    terrain: {
      terrain_cat: normalizeText(terrain.terrain_cat),
      terrain_type: normalizeText(terrain.terrain_type),
      terrain_secondaire: normalizeText(terrain.terrain_secondaire),
      colline: normalizeBooleanDraftValue(terrain.colline),
      relief: normalizeText(terrain.relief),
    },
    control: {
      peuple: normalizeText(control.peuple),
      faction: normalizeText(control.faction),
      controleur: normalizeText(control.controleur),
      controle_type: normalizeText(control.controle_type),
      controle_principal_type: normalizeText(control.controle_principal_type),
      controle_principal_id: normalizeText(control.controle_principal_id),
      controle_secondaire_type: normalizeText(control.controle_secondaire_type),
      controle_secondaire_id: normalizeText(control.controle_secondaire_id),
    },
    bonus_contextuels: hasOwnProperty(payload, "bonus_contextuels")
      ? normalizeStringArray(payload.bonus_contextuels)
      : undefined,
    dynamic: Object.fromEntries(
      Object.entries(dynamicSections)
        .filter((entry): entry is [string, Record<string, unknown>] => {
          const [tableKey, section] = entry;
          return (
            typeof tableKey === "string" &&
            tableKey.trim().length > 0 &&
            typeof section === "object" &&
            section !== null &&
            !Array.isArray(section)
          );
        })
        .map(([tableKey, section]) => [
          tableKey,
          Object.fromEntries(
            Object.entries(section).map(([fieldKey, fieldValue]) => [
              fieldKey,
              typeof fieldValue === "string" ? fieldValue : "",
            ]),
          ),
        ]),
    ),
  };
}

export function parseAdminBulkPatch(value: unknown): AdminBulkPatch {
  const payload = ensurePlainObject(value);
  const patch = ensurePlainObject(payload.patch ?? payload);
  const publicFields = patch.public ? ensurePlainObject(patch.public) : null;
  const terrain = patch.terrain ? ensurePlainObject(patch.terrain) : null;
  const control = patch.control ? ensurePlainObject(patch.control) : null;
  const result: AdminBulkPatch = {};

  if (publicFields) {
    const publicPatch: NonNullable<AdminBulkPatch["public"]> = {};

    if (hasOwnProperty(publicFields, "region")) {
      publicPatch.region = normalizeNullableText(publicFields.region);
    }

    if (hasOwnProperty(publicFields, "sous_region")) {
      publicPatch.sous_region = normalizeNullableText(publicFields.sous_region);
    }

    if (hasOwnProperty(publicFields, "cote")) {
      publicPatch.cote = parseNullableBooleanPatchValue(publicFields.cote);
    }

    if (hasOwnProperty(publicFields, "lac")) {
      publicPatch.lac = parseNullableBooleanPatchValue(publicFields.lac);
    }

    if (hasOwnProperty(publicFields, "fluvial")) {
      publicPatch.fluvial = parseNullableBooleanPatchValue(
        publicFields.fluvial,
      );
    }

    if (Object.keys(publicPatch).length > 0) {
      result.public = publicPatch;
    }
  }

  if (terrain) {
    const terrainPatch: NonNullable<AdminBulkPatch["terrain"]> = {};

    if (hasOwnProperty(terrain, "terrain_cat")) {
      terrainPatch.terrain_cat = normalizeNullableText(terrain.terrain_cat);
    }

    if (hasOwnProperty(terrain, "terrain_type")) {
      terrainPatch.terrain_type = normalizeNullableText(terrain.terrain_type);
    }

    if (hasOwnProperty(terrain, "terrain_secondaire")) {
      terrainPatch.terrain_secondaire = normalizeNullableText(
        terrain.terrain_secondaire,
      );
    }

    if (hasOwnProperty(terrain, "colline")) {
      terrainPatch.colline = parseNullableBooleanPatchValue(terrain.colline);
    }

    if (hasOwnProperty(terrain, "relief")) {
      terrainPatch.relief = normalizeNullableText(terrain.relief);
    }

    if (Object.keys(terrainPatch).length > 0) {
      result.terrain = terrainPatch;
    }
  }

  if (control) {
    const controlPatch: NonNullable<AdminBulkPatch["control"]> = {};

    if (hasOwnProperty(control, "peuple")) {
      controlPatch.peuple = normalizeNullableText(control.peuple);
    }

    if (hasOwnProperty(control, "faction")) {
      controlPatch.faction = normalizeNullableText(control.faction);
    }

    if (hasOwnProperty(control, "controleur")) {
      controlPatch.controleur = normalizeNullableText(control.controleur);
    }

    if (hasOwnProperty(control, "controle_type")) {
      controlPatch.controle_type = normalizeNullableText(control.controle_type);
    }

    if (hasOwnProperty(control, "controle_principal_type")) {
      controlPatch.controle_principal_type = normalizeNullableText(
        control.controle_principal_type,
      );
    }

    if (hasOwnProperty(control, "controle_principal_id")) {
      controlPatch.controle_principal_id = normalizeNullableText(
        control.controle_principal_id,
      );
    }

    if (hasOwnProperty(control, "controle_secondaire_type")) {
      controlPatch.controle_secondaire_type = normalizeNullableText(
        control.controle_secondaire_type,
      );
    }

    if (hasOwnProperty(control, "controle_secondaire_id")) {
      controlPatch.controle_secondaire_id = normalizeNullableText(
        control.controle_secondaire_id,
      );
    }

    if (Object.keys(controlPatch).length > 0) {
      result.control = controlPatch;
    }
  }

  if (hasOwnProperty(patch, "bonus_contextuels")) {
    result.bonus_contextuels = normalizeStringArray(patch.bonus_contextuels);
  }

  if (Object.keys(result).length === 0) {
    throw new Error(
      "Aucun champ modifie n'a ete fourni pour l'edition de masse.",
    );
  }

  return result;
}
